---
title: Webhook Notifications
description: Set up Slack, Discord, Telegram, ntfy, or custom webhook notifications
---

insightd can send alerts and weekly digests to webhook endpoints alongside email. Configure webhooks from the **Webhooks** page in the web UI.

## Supported Services

### Slack

1. Go to your Slack workspace **Settings > Manage apps > Incoming Webhooks**
2. Create a new webhook and choose a channel
3. Copy the webhook URL (starts with `https://hooks.slack.com/...`)
4. In insightd: type **Slack**, paste the URL

### Discord

1. Go to **Server Settings > Integrations > Webhooks**
2. Click **New Webhook**, choose a channel, copy the URL
3. In insightd: type **Discord**, paste the URL

### Telegram

1. Message [@BotFather](https://t.me/BotFather) on Telegram to create a bot
2. Copy the **bot token** (e.g. `123456:ABC-DEF...`)
3. Get your **chat ID** from [@userinfobot](https://t.me/userinfobot) (or use a group chat ID)
4. In insightd: type **Telegram**, paste the bot token in URL field, chat ID in Secret field

### ntfy

[ntfy](https://ntfy.sh) provides free push notifications with zero signup.

1. Pick a topic name (e.g. `insightd-alerts`)
2. Subscribe on your phone: install the ntfy app and subscribe to the topic
3. In insightd: type **ntfy**, URL is `https://ntfy.sh/insightd-alerts`

For self-hosted ntfy, use your server URL instead.

### Generic Webhook

Send raw JSON to any HTTP endpoint.

1. In insightd: type **Generic**, enter your POST URL
2. Optionally add an `Authorization` header value in the Secret field

The payload is the raw alert or digest object as JSON.

## Alert Payload

```json
{
  "event": "alert",
  "timestamp": "2026-03-31T12:00:00.000Z",
  "type": "container_down",
  "hostId": "my-server",
  "target": "nginx",
  "message": "Container \"nginx\" on my-server is down",
  "value": "exited",
  "reminderNumber": 0,
  "isResolution": false
}
```

## Digest Payload

```json
{
  "event": "digest",
  "timestamp": "2026-03-31T08:00:00.000Z",
  "weekNumber": 14,
  "overallStatus": "green",
  "summaryLine": "No critical issues. Good week.",
  "overallUptime": 99.8,
  "totalRestarts": 0,
  "hostCount": 3
}
```

## Testing

Each webhook has a **Test** button on the Webhooks page. This sends a test notification so you can verify the setup before waiting for a real alert.

## Multiple Webhooks

You can configure as many webhooks as you want. Each webhook can independently opt in to **alerts**, **digests**, or both. Failures in one webhook never block others or email delivery.
