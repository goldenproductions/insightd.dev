---
title: Configuration Reference
description: All environment variables for insightd hub and agent
---

The hub's **Settings page** is the primary configuration surface — email, alerts, webhooks, AI diagnosis, retention, and the status page are all editable there, hot-reloadable, and persisted to the hub's SQLite database. Most users never need to touch an environment variable after the initial `docker-compose.yml` in the [Quick Start](/guides/quick-start/).

The variables listed below are equivalent defaults for users who prefer declarative deployments (Docker Compose, Kubernetes, Ansible). For keys that appear both here and in the UI, the DB value wins.

:::tip
SMTP, alerts, and most settings are **hot-reloadable** — changes take effect immediately without restarting the container.
:::

## SMTP / Email

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_SMTP_HOST` | _(none)_ | SMTP server hostname |
| `INSIGHTD_SMTP_PORT` | `587` | SMTP port (587 for TLS, 465 for SSL) |
| `INSIGHTD_SMTP_USER` | _(none)_ | SMTP username |
| `INSIGHTD_SMTP_PASS` | _(none)_ | SMTP password or app password |
| `INSIGHTD_SMTP_FROM` | _(from user)_ | From address for emails |

## Digest

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_DIGEST_TO` | _(none)_ | Recipient email for weekly digest |
| `INSIGHTD_DIGEST_CRON` | `0 8 * * 1` | Digest schedule (Monday 8am) |
| `TZ` | `UTC` | Timezone for cron schedules |

## Alerts

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_ALERTS_ENABLED` | `false` | Enable real-time alerts |
| `INSIGHTD_ALERTS_TO` | _(digest recipient)_ | Alert email recipient |
| `INSIGHTD_ALERT_COOLDOWN` | `60` | Minutes between the first reminders for a persistent alert. With backoff on, this is the *base* — each subsequent reminder doubles the gap. |
| `INSIGHTD_ALERT_REMINDER_BACKOFF` | `true` | Slow down reminders for long-lived alerts. Each reminder doubles the previous gap (`60m → 2h → 4h → 8h → …`) until the cap. Prevents the inbox from filling with the same alert. |
| `INSIGHTD_ALERT_REMINDER_MAX` | `1440` | Upper bound on the gap between reminders, in minutes. Default 1440 = once per day. |
| `INSIGHTD_ALERT_DOWN` | `true` | Alert on container down |
| `INSIGHTD_ALERT_CPU` | `90` | Container CPU threshold (%) |
| `INSIGHTD_ALERT_MEMORY` | `0` | Container memory threshold (MB, 0=disabled) |
| `INSIGHTD_ALERT_RESTART` | `3` | Restart count in 30min window |
| `INSIGHTD_ALERT_UNHEALTHY` | `true` | Alert on unhealthy containers |
| `INSIGHTD_ALERT_HOST_CPU` | `90` | Host CPU threshold (%) |
| `INSIGHTD_ALERT_HOST_MEMORY` | `0` | Host low memory threshold (MB, 0=disabled) |
| `INSIGHTD_ALERT_LOAD` | `0` | Host load threshold (0=disabled) |
| `INSIGHTD_ALERT_DISK` | `90` | Disk usage threshold (%) |
| `INSIGHTD_ALERT_EXCLUDE` | _(none)_ | Exclude containers from alerts (comma-separated globs, e.g. `dev-*,test-*`) |
| `INSIGHTD_ALERT_ENDPOINT_DOWN` | `true` | Alert when HTTP endpoints go down |
| `INSIGHTD_ALERT_ENDPOINT_FAILURES` | `3` | Consecutive failures before alerting |

:::tip
Active alerts can also be **silenced per-instance** from the Alerts page or container detail page — pick a preset (1h / 4h / 1d / 7d / until resolved) to mute reminders without disabling the alert type globally. Silencing does not reset the backoff counter; reminders resume at the same step on unsilence.
:::

## Web UI

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_WEB_ENABLED` | `true` | Enable the web UI |
| `INSIGHTD_WEB_PORT` | `3000` | Web UI port |
| `INSIGHTD_WEB_HOST` | `0.0.0.0` | Bind address |
| `INSIGHTD_ADMIN_PASSWORD` | _(none)_ | Admin password for settings/webhooks |
| `INSIGHTD_EXTERNAL_HOST` | _(auto)_ | Hostname shown in agent setup commands |
| `INSIGHTD_WEB_BASE_URL` | _(none)_ | Public hub URL used in email links (e.g. `https://insightd.example.com`). Also editable from Settings → Web. Emails render fine unset; the "Open dashboard" buttons just disappear. |
| `INSIGHTD_STATUS_PAGE` | `false` | Enable public status page at `/status` (no auth) |

## MQTT (Hub Mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_MQTT_URL` | _(none)_ | MQTT broker URL (enables hub mode) |
| `INSIGHTD_MQTT_USER` | _(none)_ | MQTT username |
| `INSIGHTD_MQTT_PASS` | _(none)_ | MQTT password |
| `INSIGHTD_HOST_ID` | `local` | Host identifier (falls back to `NODE_NAME` in k8s mode) |

## Container Runtime

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_RUNTIME` | `auto` | Container runtime: `auto`, `docker`, or `kubernetes` |
| `INSIGHTD_ALLOW_ACTIONS` | `false` | Enable container start/stop/restart from UI (Docker only) |
| `INSIGHTD_ALLOW_UPDATES` | `false` | Enable remote agent self-updates (Docker only) |

## Host Grouping

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_HOST_GROUP` | _(none)_ | Optional logical group label (e.g. `production-cluster`, `basement`). Surfaces as collapsible sections on the Hosts page. The agent reports its group; a manual override on the Hosts page detail (PUT `/api/hosts/:id/group`) always wins over the env var. |

## AI Diagnosis (Gemini)

The container detail page has a "Diagnose with AI" button that sends the diagnosis context (metrics, baselines, restart history, log signals) to Google Gemini and persists the response. Disabled by default — set the API key to enable it. All settings are also available on **Settings → AI Diagnosis** in the web UI.

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | _(none)_ | Google Gemini API key. Free tier is sufficient. Get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Model name. Default is the free, fast model. `gemini-2.0-flash` is also free but returns `limit: 0` on new AI Studio projects. |
| `GEMINI_TIMEOUT_MS` | `20000` | Abort the Gemini request after this many milliseconds. |

Cache hits via `sha256(context) + 24h TTL` avoid duplicate requests. Rate limit responses (429) surface in the UI with a live cooldown countdown.

## Kubernetes (DaemonSet Mode)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_NAME` | _(none)_ | Required — node name (set via downward API in DaemonSet) |
| `NODE_IP` | _(none)_ | Node IP, used to build kubelet URL (set via downward API) |
| `INSIGHTD_KUBELET_URL` | `https://${NODE_IP}:10250` | Override the kubelet endpoint URL |

## Container Actions

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_ALLOW_ACTIONS` | `false` | Enable start/stop/restart/remove from the UI |
| `INSIGHTD_ALLOW_UPDATES` | `false` | Enable remote agent updates from the hub |

## Status Page

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_STATUS_PAGE` | `false` | Enable public status page at `/status` |
| `INSIGHTD_STATUS_PAGE_TITLE` | `System Status` | Title shown on the public status page |

## Collection

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_COLLECT_INTERVAL` | `5` | Minutes between collection cycles |
| `INSIGHTD_DISK_WARN_THRESHOLD` | `85` | Disk warning threshold (%) |

## Data Retention

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_RETENTION_RAW_DAYS` | `30` | Days to keep full-resolution snapshots (min 7). Older raw data is rolled up into hourly aggregates before deletion. |
| `INSIGHTD_RETENTION_ROLLUP_DAYS` | `365` | Days to keep hourly rollups (min 30). Rollups give you long-term trends without unbounded growth. |

:::tip
Both retention settings are hot-reloadable from the **Settings page**. The Storage card shows your current database size, last cleanup time, and a "Vacuum Now" button. Pruning runs daily at 03:30 (independent of digest delivery), with conditional VACUUM after large prunes.
:::

## Log Tailing

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_LOG_LINES` | `100` | Default log lines to fetch |
| `INSIGHTD_LOG_MAX_LINES` | `1000` | Maximum log lines (agent-side cap) |
| `INSIGHTD_LOG_TIMEOUT` | `15000` | MQTT log request timeout (ms) |

## Paths

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_DATA_DIR` | `/data` | Database storage directory |
| `INSIGHTD_HOST_ROOT` | `/host` | Host filesystem mount point |
| `DOCKER_HOST` | `/var/run/docker.sock` | Docker socket path |

## Update Checks

| Variable | Default | Description |
|----------|---------|-------------|
| `INSIGHTD_UPDATE_CHECK_CRON` | `0 3 * * *` | Daily image update check schedule |
