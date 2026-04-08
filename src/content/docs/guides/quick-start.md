---
title: Quick Start
description: Get insightd running in under 2 minutes
---

## Single Server (Standalone Mode)

The fastest way to get started. One container, no MQTT needed.

```bash
docker run -d \
  --name insightd \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /:/host:ro \
  -v insightd-data:/data \
  -p 3000:3000 \
  andreas404/insightd-hub:latest
```

Open **http://your-server:3000** and follow the **Setup Wizard** — it walks you through setting a password, configuring email, and adding agents. No `.env` file needed.

## What You'll See

- **Dashboard** — health score (click for per-host breakdown), availability, "Needs Attention" feed with metric personalities
- **Hosts** — click into any host to see containers with baseline-aware mood indicators, uptime timeline, trends
- **Containers** — CPU/memory gauges with moods, log viewer, alert history with full context
- **Alerts** — every alert shows **why** it fired (value, threshold, message)
- **Endpoints** — add HTTP URLs to monitor (requires login)

## Enable Email Alerts

You can configure email entirely from the **Settings** page in the UI — no restart required. Or use environment variables:

```bash
docker run -d \
  --name insightd \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /:/host:ro \
  -v insightd-data:/data \
  -p 3000:3000 \
  -e INSIGHTD_SMTP_HOST=smtp.gmail.com \
  -e INSIGHTD_SMTP_PORT=587 \
  -e INSIGHTD_SMTP_USER=you@gmail.com \
  -e INSIGHTD_SMTP_PASS=your-app-password \
  -e INSIGHTD_DIGEST_TO=you@gmail.com \
  -e INSIGHTD_ALERTS_ENABLED=true \
  andreas404/insightd-hub:latest
```

:::tip
For Gmail, use an [App Password](https://myaccount.google.com/apppasswords) — not your regular password. Or configure SMTP from the Settings page after setup.
:::

## Enable Webhook Notifications

Log in to the web UI, go to **Webhooks**, and add a notification channel. Supported services:

- **Slack** — incoming webhook URL
- **Discord** — webhook URL from channel settings
- **Telegram** — bot token + chat ID
- **ntfy** — free push notifications, no account needed
- **Generic** — any HTTP endpoint that accepts POST

## Next Steps

- [Docker Compose setup](/insightd.dev/guides/docker-compose/) for multi-server monitoring
- [Configuration reference](/insightd.dev/reference/config/) for all environment variables
- [Endpoint monitoring](/insightd.dev/reference/endpoints/) to monitor HTTP URLs
