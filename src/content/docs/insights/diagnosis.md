---
title: Health Check Diagnosis
description: How insightd diagnoses unhealthy containers by correlating signals across metrics, logs, and host state
---

When a container reports unhealthy, insightd doesn't just show Docker's raw health check output — it runs a **correlation-based diagnosis engine** that combines metrics, baselines, history, host state, coincident failures, and recent logs to explain *why* something is wrong and suggest *what to do*.

The same health check output (e.g. `connection refused`) can produce different diagnoses depending on the actual state of your system. A container that's running out of memory gets a different diagnosis than one caught in a host-wide cascade, even if their health checks fail identically.

## How it works

The engine builds a **diagnosis context** from signals insightd already collects:

- **Current state**: status, CPU, memory, restart count, health check output
- **Recent history**: last 2 hours of snapshots, trend direction (rising/falling/stable)
- **Baselines**: per-container P50/P75/P90/P95/P99 percentiles from the last 30 days
- **Host state**: CPU, memory, load — is the host itself under pressure?
- **Coincident failures**: are other containers on the same host also failing?
- **Active alerts**: existing alerts that might explain the failure
- **Recent logs**: last ~100 log lines, scanned for common error patterns

Then it runs a decision tree through **9 diagnosis patterns**, most-specific first. The first match wins.

## Diagnosis patterns

insightd currently recognizes these patterns when a container is unhealthy:

### 1. Running out of memory (high confidence)

**Fires when:** Memory is more than 30% above the container's P95 baseline AND trending upward over the last 2 hours.

**Conclusion:** `<container> is running out of memory`

**Suggested action:** The process is using significantly more memory than normal and rising. Increase the container's memory limit, investigate for a memory leak, or check `docker inspect <container>` for OOMKilled state.

### 2. OOM confirmed by logs (high confidence)

**Fires when:** Recent logs contain patterns like `out of memory`, `OOM-killed`, or `cannot allocate memory`.

**Conclusion:** `<container> has been killed by the OS for using too much memory`

**Suggested action:** Logs show out-of-memory errors. Increase the container's memory limit or investigate what's allocating memory.

### 3. Crash-looping (high confidence)

**Fires when:** The container has restarted 2 or more times in the last 2 hours but is still failing its health check.

**Conclusion:** `<container> is crash-looping`

**Suggested action:** Check container logs for the crash cause — if logs show startup errors, inspect config/volumes. If OOM, increase memory limit.

### 4. Wider host failure (medium confidence)

**Fires when:** At least 50% of containers on the same host are affected simultaneously.

**Conclusion:** `<container> is part of a wider failure on <host>`

**Suggested action:** This is not isolated — investigate host-level issues: network, storage, a shared dependency (database, cache), or a recent host restart.

### 5. Host under resource pressure (medium confidence)

**Fires when:** The host's CPU is above 80%, memory above 85%, or load5 above 8 — and none of the higher-severity patterns match.

**Conclusion:** `<container>'s health check is failing while the host is under resource pressure`

**Suggested action:** The host is heavily loaded. The container may be getting starved for CPU or memory. Reduce load on the host or investigate what else is consuming resources.

### 6. Application errors in logs (medium confidence)

**Fires when:** Resources are normal and there are no recent restarts, but recent logs contain error patterns (panic, fatal, HTTP 5xx, database errors, etc.).

**Conclusion:** `<container> is reporting application errors (<top pattern>)`

**Suggested action:** The container is running and resources are normal, but the application is logging errors. Check recent application logs and investigate recent config changes or upstream dependencies.

### 7. Zombie listener (medium confidence)

**Fires when:** The health check reports "connection refused", resources are stable, no recent restarts, and the host is healthy.

**Conclusion:** `<container>'s service port is not responding, but the process is still running with normal resources`

**Suggested action:** This looks like the application's listener crashed independently while the process stayed alive. Restart the container to recover. If this recurs, it may be a known issue with the application.

### 8. Slow or hung service (medium confidence)

**Fires when:** The health check reports "timed out", resources are stable, and the host is not under pressure.

**Conclusion:** `<container>'s service is responding too slowly to health checks`

**Suggested action:** The service may be hung, deadlocked, or processing a long-running operation. Check application logs for stuck operations. A restart will clear any stuck state.

### 9. Generic unhealthy (low confidence)

**Fires when:** None of the above patterns match — nothing in metrics or logs stands out.

**Conclusion:** `<container> is reporting unhealthy`

**Suggested action:** Nothing obvious stands out in metrics or logs. Check the full container logs for application errors. If the issue persists after a restart, investigate config or upstream dependencies.

## Evidence and confidence

Every diagnosis comes with:

- **Evidence list** — the specific facts that led to the conclusion (memory vs. baseline, restart count, host state, log patterns, etc.)
- **Confidence level** — `high`, `medium`, or `low` depending on how distinctive the signals are
- **Suggested action** — concrete next step for the operator

High-confidence findings are shown as **critical** severity; medium and low are **warning**.

## Log pattern recognition

When recent logs are available (cached for 5 minutes, pre-warmed when a container goes unhealthy), insightd scans for 17 common error patterns:

- **Memory**: out of memory, OOM-killed, cannot allocate memory
- **Crashes**: panic, segmentation fault, sigsegv, fatal
- **Network**: connection refused, connection reset, i/o timeout, connection timed out
- **DNS**: no such host, name resolution, could not resolve
- **Filesystem**: disk full, no space left, too many open files, permission denied
- **Databases**: database locked, sqlite busy
- **HTTP**: 401 unauthorized, 403 forbidden, 404 not found, 502 bad gateway, 503 unavailable

Patterns are deliberately cross-language — they work for Go, Python, Node, Java, Rust, and C services. The most-frequent pattern becomes evidence in the diagnosis.

## Works for any container

The diagnosis engine is completely **name-agnostic** — it doesn't care what the container is named or what service it runs. Every unhealthy container on every host goes through the same decision tree, and the outcome depends on that container's own signals: its own baselines, its own history, its own logs.

## When it runs

Diagnosis runs in two places:

- **On-demand** — when you open a container's detail page, diagnosis runs instantly (typically under 100ms) and the result is attached to the page response. If logs aren't cached yet, a background fetch is triggered so the next view is enriched.
- **Hourly** — during the regular insights cycle, all unhealthy containers get diagnosed and the findings are persisted to the `insights` table, driving alerts and webhooks.

## Where diagnoses appear

- **Container detail page** — structured finding card with conclusion, evidence, suggested action, and expandable technical details
- **Insights page** — health findings grouped alongside other insights
- **Dashboard** — top health findings in the Insights feed
- **Alert emails / webhooks** — when hourly persistence runs, findings trigger alert notifications with the full diagnosis

## Kubernetes caveat

Kubernetes pod probes don't expose probe output (this is a Kubernetes API limitation). Containers running under the Kubernetes runtime only get signal-based diagnoses (resource trends, restart patterns, cascade detection) — output-driven patterns like "zombie listener" won't fire without probe output to match on.

## Extending the engine

If you run into a service that consistently lands in the generic fallback, the engine is designed to be extended:

- **New log patterns** can be added to the log parser without touching the decision tree
- **New diagnosis patterns** are just additional `else if` blocks in the decision tree
- **Entirely new diagnosers** (for high memory, restart anomalies, host pressure) can be added as separate files that produce their own findings

All extensions are isolated and non-breaking — the framework composes diagnosers automatically.
