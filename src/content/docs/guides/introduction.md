---
title: Introduction
description: What insightd is and who it's for
---

## What is insightd?

insightd is a self-hosted server awareness tool designed for homelabbers. It fills the gap between reactive alerting tools (like Uptime Kuma) and heavyweight monitoring stacks (like Prometheus + Grafana).

With insightd you get:

- **Container monitoring** across multiple hosts — status, CPU, RAM, restarts, network I/O, health checks
- **Host system metrics** — CPU, memory, load average, uptime, disk usage
- **HTTP endpoint monitoring** — uptime, response time, alerting
- **Smart alerts** via email + webhooks (Slack, Discord, Telegram, ntfy)
- **Weekly digest emails** summarizing what happened
- **Modern web dashboard** with dark/light theme

## Who is it for?

- **Homelabbers** running Docker containers across one or more servers
- **Self-hosters** who want to know when things break without setting up Prometheus
- **Small teams** who need basic monitoring without SaaS costs

## Architecture

insightd runs in two modes:

### Standalone Mode

One container that monitors Docker and the host system directly. Best for single-server setups.

```
[insightd-hub] → Docker socket → collects metrics → SQLite → Web UI
```

### Hub + Agent Mode

For multi-server setups. A lightweight agent runs on each host and reports to a central hub via MQTT.

```
[Agent on host-1] ─┐
[Agent on host-2] ─┤→ MQTT (Mosquitto) → [Hub] → SQLite → Web UI + Email + Webhooks
[Agent on host-3] ─┘
```

## Requirements

- Docker (any recent version)
- ~40MB RAM for the hub, ~15MB per agent
- Port 3000 for the web UI (configurable)
- Port 1883 for MQTT (hub mode only)
