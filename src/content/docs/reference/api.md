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

All alerts with context (message, trigger value, threshold). Query: `?active=false` to include resolved alerts (default shows active only).

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
