---
title: Health Check Diagnosis
description: How insightd's signal-driven diagnosis engine explains why a container is unhealthy — with log template mining, robust baselines, graph-based root cause ranking, and calibrated confidence.
---

When a container reports unhealthy, insightd doesn't just show Docker's raw health check output — it runs a **signal-driven diagnosis engine** grounded in published research that combines metrics, robust baselines, history, host state, coincident failures, mined log patterns, and an implicit service topology graph to explain *why* something is wrong and suggest *what to do*.

The same health check output (e.g. `connection refused`) can produce different diagnoses depending on the actual state of your system. A container that's running out of memory gets a different diagnosis than one caught in a host-wide cascade, even if their health checks fail identically.

## How it works

The engine builds a **diagnosis context** from signals insightd already collects, then runs every [signal detector](#signal-detectors) against it. Each detector is a small pure function that returns either a typed `FindingSignal` or `null`. The unified diagnoser sorts the fired signals by priority, picks the most specific one as the finding's primary conclusion, merges the supporting evidence from the others, and tacks on ranked root-cause neighbors from the graph.

The diagnosis context includes:

- **Current state**: status, CPU, memory, restart count, health check output
- **Recent history**: last 2 hours of snapshots, trend direction (rising/falling/stable)
- **Robust baselines**: per-container `p50` + `MAD` (median absolute deviation) from the last 30 days. Current values are rated against `|value − p50| / MAD` z-score bands (`normal < 2.0 ≤ elevated < 3.5 ≤ critical`) with a per-metric absolute noise floor so idle containers don't get flagged on 0.5% drift.
- **Host state**: CPU, memory, load — is the host itself under pressure?
- **Coincident failures**: are other containers on the same host also failing?
- **Active alerts**: existing alerts that might explain the failure
- **Recent logs**: last ~100 log lines, mined into templates via [Drain](#drain-log-template-mining)
- **Implicit service graph**: edges from same-host, same-compose-project, same-service-group, and runtime metric correlation. Drives [related services ranking](#related-services-ppr).

## Signal detectors

insightd currently ships seven signal detectors. Each emits a typed signal with a short label (used for UI chips), a conclusion (used as the finding title when the signal wins), evidence bullets, and a priority used for winner-takes-all ordering.

### OOM risk / OOM killed (critical · high confidence)

Fires in two modes:

- **OOM risk** — memory is rated `critical` against the robust-z baseline AND trending upward over the last 2 hours. Pre-emptive warning before the kernel kills the process.
- **OOM killed** — recent log templates carry the `oom` semantic tag (matches `out of memory`, `OOM-killed`, `cannot allocate memory`). Confirmed.

**Suggested action:** Increase the container's memory limit, investigate for a memory leak, or check `docker inspect <container>` for `OOMKilled: true`.

### Crash loop (critical · high confidence)

**Fires when:** The container has restarted 2 or more times in the last 2 hours but is still failing its health check.

**Suggested action:** Check container logs for the crash cause. Startup errors usually point to config/volume mounts; OOM at boot means the memory limit is too low even for idle.

### Cascade failure (warning · medium confidence)

**Fires when:** At least 50% of containers on the same host are failing simultaneously and at least 2 sibling containers are affected.

**Suggested action:** This is not isolated. Investigate host-level issues: network, storage, a shared dependency (database, cache), or a recent host restart. The diagnosis card will link to the other affected services under "Related services".

### Host under pressure (warning · medium confidence)

**Fires when:** The host's CPU is above 80%, memory above 85%, or load5 above 8 — and none of the higher-severity patterns match.

**Suggested action:** The container may be getting starved for CPU or memory. Reduce load on the host or investigate what else is consuming resources.

### App errors (warning · medium confidence)

**Fires when:** Resources are normal and there are no recent restarts, but recent log templates carry a semantic error tag (panic, fatal, HTTP 5xx, database errors, DNS failures, etc.).

**Suggested action:** The container is running and resources are normal, but the application is logging errors. Check recent application logs and investigate recent config changes or upstream dependencies. Drain template bursts (e.g. "the same error template appeared 47 times in 5 minutes") get surfaced directly as evidence.

### Zombie listener (warning · medium confidence)

**Fires when:** The health check reports "connection refused", resources are stable, no recent restarts, and the host is healthy.

**Suggested action:** The application's listener crashed independently while the process stayed alive. Restart the container to recover. If this recurs, it may be a known issue with the application.

### Hung service (warning · medium confidence)

**Fires when:** The health check reports "timed out", resources are stable, and the host is not under pressure.

**Suggested action:** The service may be hung, deadlocked, or processing a long-running operation. Check application logs for stuck operations. A restart will clear any stuck state.

### Fallback (warning · low confidence)

**Fires when:** None of the above signals match. Nothing in metrics, logs, or coincident failures stands out.

**Suggested action:** Check the full container logs for application errors. If the issue persists after a restart, investigate config or upstream dependencies.

## Drain log template mining

Instead of hand-written regex patterns, insightd mines incoming log lines into **templates** using [Drain](https://pinjiahe.github.io/papers/ICWS17.pdf) (He et al., ICWS 2017) — an online log parser that clusters lines by structure via a fixed-depth tree. The tokenizer masks variable parts (numbers, IPs, UUIDs, hex digests, timestamps) to `<*>` so lines like:

```
2026/04/13 14:47:54.325239 [error] dnsproxy: exchange failed upstream=10.0.0.1
2026/04/13 14:52:53.196989 [error] dnsproxy: exchange failed upstream=10.0.0.2
2026/04/13 15:00:06.699472 [error] dnsproxy: exchange failed upstream=192.168.1.5
```

collapse to a single template:

```
<*> <*> [error] dnsproxy: exchange failed upstream=<*>
```

Templates are persisted per container image (so multiple redis instances share their template tree) and accumulate an occurrence count over time. A thin **semantic classifier** applies 17 overlay regexes **once per newly-created template** to tag it with a known failure class (oom, panic, conn_refused, disk_full, http_502, etc.) for use in the signal detectors.

This unlocks three new signal types:

1. **Semantic tag hits** — same as the old regex matching, just applied to templates instead of every line (way cheaper).
2. **Template bursts** — templates that fired ≥3 times in the recent log window and carry a semantic tag or are newly created.
3. **Unseen templates** — new templates never observed in the 30-day template history. Strong signal that something changed.

The container detail page renders mined templates in a **Known log patterns** expander with a ✨ NEW badge for templates first-seen in the last 5 minutes.

## Related services (PPR)

Every 15 minutes, the scheduler builds an implicit **service topology graph** from signals insightd already collects:

- **`same_host`** — containers on the same host (weight 0.3)
- **`same_compose`** — containers sharing a `com.docker.compose.project` label (weight 0.6)
- **`same_group`** — containers in the same manual service group (weight 0.7)
- **`metric_corr`** — containers whose CPU or memory rollups are Pearson-correlated over the last 48 hours (weight = correlation strength, capped at 1.0). Only computed for pairs that already share a structural edge, so this is cheap.

When a container's diagnosis runs, insightd seeds **Personalized PageRank** (α=0.85, 30 iterations) at the symptom container and returns the top 5 neighbors by stationary probability — the services most likely to be causally connected to the failure.

Neighbors are rendered in the FindingCard as clickable chips under **Related services**, each with a pill showing the strongest edge type. One click jumps to the neighbor's detail page.

Based on [MicroRCA](https://hal.science/hal-02441640/document) (Wu et al., NOMS 2020) and [MonitorRank](https://dl.acm.org/doi/10.1145/2465529.2465753) (Kim et al., SIGMETRICS 2013), adapted for homelab scale where the "graph" comes from compose labels + co-location + metric correlation instead of distributed traces.

## Historical anomalies (S-H-ESD)

In addition to live diagnosis, insightd runs [Seasonal-Hybrid ESD](https://arxiv.org/abs/1704.07706) anomaly detection on hourly rollups for every host + container metric. The algorithm:

1. Loads the last 14 days of hourly rollups (minimum 7 days required)
2. Decomposes into seasonal (7-day rolling median) + residual components
3. Runs generalized ESD on the residuals with a robust-z threshold of 3.5

Detected spikes get upserted into a `rollup_anomalies` table and surface on both the container detail page and the host detail page in a **Historical anomalies** collapsible card. Severity badges are keyed on the robust-z score (`critical ≥ 10, warning ≥ 5, info otherwise`).

This catches retrospective events like "that CPU spike at 03:00 last Tuesday" without needing a running incident.

## Evidence ranking

Every finding is scored through a lightweight Adtributor-style ranker ([Bhagwan et al., NSDI 2014](https://www.usenix.org/system/files/conference/nsdi14/nsdi14-paper-bhagwan.pdf)):

```
score = surprise × explanatoryPower
```

Each signal kind has a fixed `surprise` score (e.g. OOM = 5.0, crash_loop = 5.0, cascade = 3.5, app_errors = 2.5) multiplied by a confidence bump (high = 1.3×, medium = 1.0×, low = 0.7×). Explanatory power is the signal's share of total surprise across all fired signals. The top-3 ranked items become short **signal chips** in the diagnosis card:

```
[Zombie listener  67%]  [Correlated with 1 service  33%]
```

When a finding has only one winning signal, the chip row is hidden — it would just restate the card title.

## Calibrated confidence

When you give feedback on a diagnosis (👍 / 👎 on a FindingCard), the vote is recorded against the `(diagnoser, conclusion_tag)` pair in a `confidence_calibration` table. After **5 or more** votes for the same finding type, the engine computes a Beta(2,2) posterior:

```
p_helpful = (helpful + 2) / (helpful + unhelpful + 4)
```

and overrides the diagnoser's self-assigned confidence:

- `p ≥ 0.75` → `high`
- `p ≥ 0.50` → `medium`
- otherwise → `low`

So if you consistently mark a specific diagnosis as helpful, future runs of that same diagnosis will show as high confidence — the engine *learns* what's useful on your specific fleet. Below 5 votes the posterior is too noisy to trust, so the diagnoser's prior stays in force.

Feedback from the **Insights page** and from the **Container detail page** both feed the same calibration table. Only `health` category insights get calibrated today (that's what the unified diagnoser produces); performance / trend / prediction insights remain view-only.

## Works for any container

The diagnosis engine is completely **name-agnostic** — it doesn't care what the container is named or what service it runs. Every unhealthy container on every host goes through the same signal detectors, and the outcome depends on that container's own signals: its own baselines, its own history, its own mined log templates, its own neighbors in the graph.

## When it runs

Diagnosis runs in two places:

- **On-demand** — when you open a container's detail page, diagnosis runs instantly (typically under 100ms) and the result is attached to the page response. If logs aren't cached yet, a background fetch is triggered so the next view is enriched with mined templates.
- **Scheduled (every 15 minutes)** — the scheduler rebuilds the RCA graph, recomputes baselines, runs the insights detector which iterates unhealthy containers and persists diagnoses to the `insights` table (driving alerts and webhooks), then runs the S-H-ESD pass on hourly rollups.

## Where diagnoses appear

- **Container detail page** — structured FindingCard with severity-colored signal chips, calibrated confidence pill, evidence list visible by default, **Related services** section with clickable neighbors, expandable **Current signals** / **Technical details** / **Known log patterns** / **Historical anomalies** sections, and inline thumbs-up/down for feedback
- **Host detail page** — **Historical anomalies** card showing S-H-ESD detections for the host's metrics
- **Insights page** — persisted health findings with a one-line evidence summary under each title, thumbs up/down wired to calibration
- **Dashboard** — top health findings in the Insights feed
- **Alert emails / webhooks** — when scheduled persistence runs, findings trigger alert notifications with the full structured diagnosis

## Kubernetes caveat

Kubernetes pod probes don't expose probe output (this is a Kubernetes API limitation). Containers running under the Kubernetes runtime only get signal-based diagnoses that don't depend on health check text (OOM, crash loop, host pressure, cascade, resource trends, graph correlations, log-template bursts) — output-driven signals like "zombie listener" and "hung service" won't fire without probe output to match on.

## Extending the engine

The signal-driven architecture is designed for extension:

- **New signal detectors** are small pure files under `hub/src/insights/diagnosis/signals/`. Each exports `detect(ctx): FindingSignal | null`. Add the detector to the `SIGNAL_DETECTORS` array in `diagnosers/unified.ts` and it runs on every diagnosis pass.
- **New log template rules** can be added to the semantic classifier at `hub/src/insights/diagnosis/templateClassifier.ts`. They apply retroactively to new template matches.
- **New graph edge types** slot into `hub/src/insights/rca/graph.ts:buildGraph()`. PPR automatically incorporates them.
- **Tune the ranker** by adjusting signal kinds' intrinsic surprise constants in `hub/src/insights/diagnosis/rank.ts`.
- **Re-weight calibration** by tuning the Beta prior or the threshold bands in `hub/src/insights/diagnosis/calibration.ts`.

All extensions are isolated and non-breaking — the framework composes detectors automatically, and findings from older schemas keep rendering because `evidenceRanked`, `neighbors`, and `signals` are all optional fields on the Finding type.
