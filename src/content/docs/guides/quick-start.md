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
  -e INSIGHTD_ADMIN_PASSWORD=your-password \
  andreas404/insightd-hub:0.1.0
```

Open **http://your-server:3000** in your browser.

## What You'll See

- **Dashboard** — host/container counts, active alerts, top resource consumers
- **Hosts** — click into any host to see containers, uptime timeline, trends, disk usage
- **Containers** — CPU/memory charts, log viewer, alert history
- **Endpoints** — add HTTP URLs to monitor (requires login)

## Enable Email Alerts

Add SMTP configuration to get alert emails and weekly digests:

```bash
docker run -d \
  --name insightd \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /:/host:ro \
  -v insightd-data:/data \
  -p 3000:3000 \
  -e INSIGHTD_ADMIN_PASSWORD=your-password \
  -e INSIGHTD_SMTP_HOST=smtp.gmail.com \
  -e INSIGHTD_SMTP_PORT=587 \
  -e INSIGHTD_SMTP_USER=you@gmail.com \
  -e INSIGHTD_SMTP_PASS=your-app-password \
  -e INSIGHTD_SMTP_FROM=you@gmail.com \
  -e INSIGHTD_DIGEST_TO=you@gmail.com \
  -e INSIGHTD_ALERTS_ENABLED=true \
  andreas404/insightd-hub:0.1.0
```

:::tip
For Gmail, use an [App Password](https://myaccount.google.com/apppasswords) — not your regular password.
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
