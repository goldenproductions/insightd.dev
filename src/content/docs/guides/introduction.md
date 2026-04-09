---
title: Introduction
description: What insightd is and who it's for
---

## What is insightd?

insightd is a self-hosted server awareness tool designed for homelabbers. It fills the gap between reactive alerting tools (like Uptime Kuma) and heavyweight monitoring stacks (like Prometheus + Grafana).

With insightd you get:

- **Multi-runtime support** — monitor Docker, Kubernetes, and k3s from the same hub
- **Container monitoring** across multiple hosts — status, CPU, RAM, restarts, network I/O, health checks
- **Host system metrics** — CPU, memory, load average, uptime, disk usage, GPU, temperature
- **HTTP endpoint monitoring** — uptime, response time, alerting
- **Smart insights engine** — capacity-based health scoring, predictions, trends, with thumbs up/down feedback
- **Explainable alerts** — every alert stores why it fired (value + threshold), with email and webhook delivery (Slack, Discord, Telegram, ntfy)
- **Metric personalities** — baseline-aware human-friendly moods on every metric (e.g. "😌 Normal", "🔥 Way above normal")
- **Health score breakdown** — click to see per-host factor analysis explaining your system health
- **Container actions** — start, stop, restart, and remove containers from the UI (Docker mode)
- **Weekly digest emails** summarizing what happened
- **Modern web dashboard** — setup wizard configures everything from the UI, no `.env` file required

## Who is it for?

- **Homelabbers** running Docker containers across one or more servers
- **Self-hosters** who want to know when things break without setting up Prometheus
- **Small teams** who need basic monitoring without SaaS costs

## Architecture

insightd runs in three modes depending on your setup:

### Standalone Mode (Docker, single server)

One container that monitors Docker and the host system directly. Best for single-server setups.

```
[insightd-hub] → Docker socket → collects metrics → SQLite → Web UI
```

### Hub + Agent Mode (multi-server Docker)

For monitoring multiple Docker hosts. A lightweight agent runs on each host and reports to a central hub via MQTT.

```
[Agent on host-1] ─┐
[Agent on host-2] ─┤→ MQTT (Mosquitto) → [Hub] → SQLite → Web UI + Email + Webhooks
[Agent on host-3] ─┘
```

### Kubernetes / k3s Mode (DaemonSet)

The agent runs as a DaemonSet — one pod per node. Each pod's containers appear in the dashboard as `{namespace}/{pod-name}/{container-name}`. Read-only monitoring (actions and image update checks aren't available — those are managed by the cluster).

```
node-1: [agent pod] ─┐
node-2: [agent pod] ─┤→ MQTT → [Hub] → Web UI
node-3: [agent pod] ─┘
```

## Requirements

- Docker (any recent version) or Kubernetes/k3s
- ~30MB RAM for the hub, ~20MB per agent
- Port 3000 for the web UI (configurable)
- Port 1883 for MQTT (hub mode only)
