---
title: Endpoint Monitoring
description: Monitor HTTP endpoints for uptime and response time
---

insightd can monitor HTTP/HTTPS endpoints for uptime, response time, and availability — similar to Uptime Kuma but integrated with your container monitoring.

## Adding Endpoints

1. Log in to the web UI (click **Settings** in the sidebar to enter your admin password)
2. Go to **Endpoints** and click **Add Endpoint**
3. Fill in the form:

| Field | Description | Default |
|-------|-------------|---------|
| **Name** | Display name for this endpoint | Required |
| **URL** | Full URL to monitor (must start with `http://` or `https://`) | Required |
| **Method** | HTTP method | `GET` |
| **Expected Status** | Status code that means "up" | `200` |
| **Interval** | Seconds between checks (10-3600) | `60` |
| **Timeout** | Request timeout in milliseconds (1000-30000) | `10000` |
| **Headers** | Custom headers as JSON (e.g. `{"Authorization":"Bearer xxx"}`) | _(none)_ |
| **Enabled** | Whether this endpoint is actively monitored | `Yes` |

## How It Works

- The **hub** probes each endpoint directly (not agents)
- Checks run on a 1-minute scheduler tick; each endpoint's interval determines when it's actually due
- Results are stored in the `http_checks` table (30-day retention)
- The checker respects timeouts and follows redirects

## Private Network Endpoints

Since the hub makes HTTP requests directly, it can monitor endpoints on private networks it has access to. This is a major advantage over external monitoring services.

```
http://192.168.1.50:8080/health
http://my-nas:9090/api/status
```

## Alerts

When an endpoint fails **3 consecutive checks** (configurable), an `endpoint_down` alert fires. The alert resolves automatically when the endpoint recovers.

Configure the threshold via:
- Environment variable: `INSIGHTD_ALERT_ENDPOINT_FAILURES=3`
- Settings page: **Endpoint Failure Threshold**

## Dashboard

When you have endpoints configured, the dashboard shows an **Endpoints Up X/Y** stat card. The Endpoints page shows a table with:

- Status (up/down dot)
- 24-hour uptime percentage
- Average response time
- Last check time

## Endpoint Detail

Click any endpoint to see:

- Current status with 24h and 7d uptime percentages
- Response time bar chart (last 24 hours)
- Check history table with status codes and errors

## Weekly Digest

Endpoints with less than 99% uptime are flagged in the weekly digest email and webhook notifications.
