---
title: Introduction
description: What insightd is and who it's for
---

## What is insightd?

insightd is a self-hosted server awareness tool designed for homelabbers. It fills the gap between reactive alerting tools (like Uptime Kuma) and heavyweight monitoring stacks (like Prometheus + Grafana).

With insightd you get:

- **Container monitoring** across multiple hosts — status, CPU, RAM, restarts, network I/O, health checks
- **Host system metrics** — CPU, memory, load average, uptime, disk usage, GPU, temperature
- **HTTP endpoint monitoring** — uptime, response time, alerting
- **Explainable alerts** — every alert stores why it fired (value + threshold), with email and webhook delivery (Slack, Discord, Telegram, ntfy)
- **Metric personalities** — baseline-aware human-friendly moods on every metric (e.g. "😌 Normal", "🔥 Way above normal")
- **Health score breakdown** — click to see per-host factor analysis explaining your system health
- **Container actions** — start, stop, restart, and remove containers from the UI
- **Weekly digest emails** summarizing what happened
- **Modern web dashboard** — setup wizard configures everything from the UI, no `.env` file required

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
