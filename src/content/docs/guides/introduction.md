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
- **Smart insights engine** — capacity-based health scoring, predictions, trends, and a correlation-based diagnosis engine that explains *why* a container is unhealthy
- **Explainable alerts** — every alert stores why it fired (value + threshold), with email and webhook delivery (Slack, Discord, Telegram, ntfy)
- **Metric personalities** — baseline-aware human-friendly moods on every metric (e.g. "😌 Normal", "🔥 Way above normal")
- **Health score breakdown** — click to see per-host factor analysis explaining your system health
- **Container actions** — start, stop, restart, and remove containers from the UI (Docker mode)
- **Kubernetes-aware** — cluster Warning events, node conditions as alerts, container resource-limit saturation alerts, PV / PVC inventory, and Ingress auto-discovery into the HTTP endpoint monitor
- **Weekly digest emails** summarizing what happened
- **Modern web dashboard** — setup wizard configures everything from the UI, no `.env` file required

## Who is it for?

- **Homelabbers** running Docker containers across one or more servers
- **Self-hosters** who want to know when things break without setting up Prometheus
- **Small teams** who need basic monitoring without SaaS costs

## Architecture

One hub, one Mosquitto broker, and one agent per monitored host. To monitor ten hosts instead of one, you run nine more agents — nothing else changes.

```
[agent per host] ─┐
[agent per host] ─┼─► MQTT (Mosquitto) ─► [hub] ─► SQLite ─► Web UI + Email + Webhooks
[agent per host] ─┘
```

On Kubernetes / k3s the agent runs as a **DaemonSet** — one pod per node, reporting to the same hub and Mosquitto broker. Each pod's containers appear in the dashboard as `{namespace}/{pod-name}/{container-name}`. See the [Kubernetes guide](/guides/kubernetes/).

Everything that isn't installation — email, alerts, webhooks, AI diagnosis, retention, the status page — is configured from the hub's **Settings** page after first boot. A one-time setup wizard handles the admin password, SMTP, and the command for adding your first agent.

## Requirements

- Docker Engine + Compose v2, or a Kubernetes/k3s cluster for the agents
- ~30 MB RAM for the hub, ~20 MB per agent
- TCP port 3000 for the web UI (configurable)
- TCP port 1883 for MQTT (LAN only)
