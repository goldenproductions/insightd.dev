---
title: REST API
description: API reference for programmatic access to insightd data
---

The insightd hub exposes a REST API on the same port as the web UI (default 3000). All responses are JSON.

## Authentication

Endpoints marked with **Auth** require a bearer token. Obtain one by posting to `/api/auth`:

```bash
curl -X POST http://localhost:3000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"password":"your-admin-password"}'
```

Response: `{"token":"..."}`. Use it in subsequent requests:

```bash
curl http://localhost:3000/api/settings \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Health

### `GET /api/health`

Returns hub status, version, schema version, auth and mode info.

## Hosts & Containers

### `GET /api/hosts`

List all known hosts with online status.

### `GET /api/hosts/:hostId`

Host detail including containers, disk, alerts, updates, host metrics, and disk forecast.

### `GET /api/hosts/:hostId/containers`

Latest container snapshots for a host.

### `GET /api/hosts/:hostId/containers/:containerName`

Container detail with 24h history and alerts. Query: `?hours=24` (1-720).

### `GET /api/hosts/:hostId/containers/:containerName/logs`

Container logs. Query: `?lines=100&stream=both` (stream: `stdout`, `stderr`, `both`).

### `GET /api/hosts/:hostId/timeline`

7-day uptime timeline per container. Query: `?days=7` (1-30).

### `GET /api/hosts/:hostId/trends`

CPU/memory trends (this week vs last week) for containers and host.

### `GET /api/hosts/:hostId/events`

Status change events and alerts. Query: `?days=7` (1-30).

### `GET /api/hosts/:hostId/metrics`

Host metrics history. Query: `?hours=24` (1-720).

### `GET /api/hosts/:hostId/disk`

Latest disk usage per mount point.

## Dashboard

### `GET /api/dashboard`

Summary stats: host counts, container counts, active alerts, disk warnings, updates, endpoint status.

### `GET /api/rankings`

Top CPU and memory consumers. Query: `?limit=5` (1-50).

## Container Actions

### `POST /api/hosts/:hostId/containers/:containerName/action` (Auth)

Perform a container action. Body: `{"action": "start|stop|restart"}`.

Requires `INSIGHTD_ALLOW_ACTIONS=true` on the agent.

### `DELETE /api/hosts/:hostId/containers/:containerName` (Auth)

Remove a container from Docker (if it exists) and clean all insightd data (snapshots, alerts, baselines, health scores, service group memberships). Works for containers that were already manually removed.

### `DELETE /api/hosts/:hostId` (Auth)

Remove a host and all its data.

## Alerts

### `GET /api/alerts`

All alerts (active + resolved) with context (message, trigger value, threshold, silence state). Query: `?activeOnly=true` to filter to currently-active alerts only. The legacy `?active=false` form is still accepted as an alias for "all".

Each alert row includes `silenced_until`, `silenced_by`, and `silenced_at` (all `null` when not silenced). The sentinel `'9999-12-31 23:59:59'` represents "until the alert resolves naturally".

### `POST /api/alerts/:id/silence` (Auth)

Silence an alert's reminder notifications. Body: `{"durationMinutes": 60}` for a fixed window, or `{"durationMinutes": "resolved"}` to silence until the alert resolves naturally.

- `409` if the alert is already resolved (nothing to silence)
- `404` if the alert id is unknown
- Returns the updated alert row

Silencing only blocks **reminders** — the initial notification has already fired by the time the alert exists. Silencing does **not** reset the reminder backoff counter (`notify_count`); when the silence expires, the exponential backoff from `INSIGHTD_ALERT_REMINDER_BACKOFF` resumes at the same step.

Webhook delivery inherits the silencing automatically — silenced alerts skip both email and webhook reminders.

### `DELETE /api/alerts/:id/silence` (Auth)

Clear an alert's silence state. Returns the updated alert row.

### `DELETE /api/alerts/:id` (Auth)

Permanently delete a resolved alert from history. Refuses with `409` if the alert is still active — silencing is the right tool for those, since the next evaluator run would just re-create the row.

## AI Diagnosis

The "Diagnose with AI" feature on the container detail page sends the diagnosis context to Google Gemini and persists the structured response. Disabled by default; configure via `GEMINI_API_KEY` (see [Configuration Reference](/insightd.dev/reference/config/)) or the **Settings → AI Diagnosis** page.

### `GET /api/ai-diagnose/status`

Returns `{ enabled: boolean, model: string | null }`. Enabled when a Gemini API key is configured.

### `GET /api/hosts/:hostId/containers/:containerName/ai-diagnose`

Latest persisted AI diagnosis for a container, or `404` if none exists. Includes `rootCause`, `reasoning`, `suggestedFix`, `confidence` (0–1), `caveats[]`, `model`, `latencyMs`, `createdAt`, and `cached` (true if returned from the 24h cache).

### `POST /api/hosts/:hostId/containers/:containerName/ai-diagnose` (Auth)

Run a fresh AI diagnosis against the current container context. Returns the same shape as the GET endpoint. Cache hits via sha256(context) avoid sending duplicate requests within 24h. Returns `429` if Gemini rate-limited the request.

## HTTP Endpoints

### `GET /api/endpoints`

List all endpoints with latest status and 24h uptime.

### `POST /api/endpoints` (Auth)

Create an endpoint. Body: `{name, url, method?, expectedStatus?, intervalSeconds?, timeoutMs?, headers?, enabled?}`.

### `GET /api/endpoints/:id`

Endpoint detail with 24h/7d uptime and avg response time.

### `PUT /api/endpoints/:id` (Auth)

Update an endpoint.

### `DELETE /api/endpoints/:id` (Auth)

Delete an endpoint and all its check history.

### `GET /api/endpoints/:id/checks`

Check history. Query: `?hours=24` (1-720).

## Webhooks

### `GET /api/webhooks` (Auth)

List all configured webhooks.

### `POST /api/webhooks` (Auth)

Create a webhook. Body: `{name, type, url, secret?, onAlert?, onDigest?, enabled?}`.

Types: `slack`, `discord`, `telegram`, `ntfy`, `generic`.

### `GET /api/webhooks/:id` (Auth)

Get a single webhook.

### `PUT /api/webhooks/:id` (Auth)

Update a webhook.

### `DELETE /api/webhooks/:id` (Auth)

Delete a webhook.

### `POST /api/webhooks/:id/test` (Auth)

Send a test notification to a saved webhook.

### `POST /api/webhooks/test` (Auth)

Send a test notification to an unsaved webhook config (pass full webhook body).

## Settings

### `GET /api/settings` (Auth)

All settings grouped by category, with current values and sources.

### `PUT /api/settings` (Auth)

Update settings. Body: `{"key": "value", ...}`.

## Insights & Baselines

### `GET /api/baselines/:entityType/:entityId`

Baselines (p50/p75/p90/p95/p99) for a host or container. Entity types: `host`, `container`. Container entity IDs use format `hostId/containerName` (URL-encode the slash).

### `GET /api/health-scores`

All health scores with per-factor breakdowns (CPU, Memory, Load, Online, Alerts scores and ratings).

### `GET /api/health-scores/:entityType/:entityId`

Health score for a specific entity.

### `GET /api/insights`

Latest anomaly insights (performance issues, predictions, correlations, health diagnoses). Health-category insights include `evidence` (JSON array), `suggested_action`, and `confidence` fields populated by the diagnosis engine.

## Storage

### `GET /api/storage` (Auth)

Returns database size on disk, per-table row counts and oldest timestamps, current retention settings, and last prune/vacuum timestamps.

### `POST /api/storage/vacuum` (Auth)

Manually run SQLite VACUUM to reclaim disk space after pruning. Returns `{ before, after, reclaimed }` (bytes).

## Version Check

### `GET /api/version-check`

Returns current hub version and the latest hub/agent versions known from the last Docker Hub check.

### `POST /api/version-check` (Auth)

Force an immediate check against Docker Hub for new hub and agent versions. Returns the refreshed version info.

## Agent Setup

### `GET /api/agent-setup`

Returns MQTT URL, credentials, and agent Docker image for the agent install generator.
