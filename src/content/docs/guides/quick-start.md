---
title: Quick Start
description: Install insightd with Docker Compose in about five minutes
---

insightd runs as three containers managed by Docker Compose:

- **Mosquitto** — MQTT broker that connects agents to the hub.
- **Hub** — web UI, database, insights and diagnosis engine.
- **Agent** — collects metrics for one host. Run one per host you want to monitor.

To monitor one server, run all three on that server. To monitor ten, you run the same stack once and then add one more agent container on each additional host. That's the only difference.

This guide uses the official images published on Docker Hub — no building from source.

## Prerequisites

- A Linux server with Docker Engine and the Compose plugin (`docker compose version` should report v2).
- Free TCP ports **3000** (web UI) and **1883** (MQTT). Keep `1883` on your LAN — don't expose it publicly.

## Step 1 — Create a working directory

```bash
mkdir -p ~/insightd && cd ~/insightd
```

## Step 2 — Configure Mosquitto

Run the block below. Replace `CHANGEME` with a strong password you'll remember — the hub and every agent need it.

```bash
cat > mosquitto.conf <<'EOF'
listener 1883
allow_anonymous false
password_file /mosquitto/config/passwd
persistence true
persistence_location /mosquitto/data/
EOF

docker run --rm -v "$PWD:/work" eclipse-mosquitto:2 \
  mosquitto_passwd -b -c /work/passwd insightd CHANGEME
```

This creates `mosquitto.conf` and a hashed `passwd` file in the current directory.

:::caution
Write your MQTT password down. You'll paste it into `docker-compose.yml` below and you'll need it again whenever you add a new agent.
:::

## Step 3 — Create `docker-compose.yml`

Save the file below in `~/insightd/`. Replace every `CHANGEME` with the MQTT password from Step 2, and pick a descriptive name for `INSIGHTD_HOST_ID` — that's the label this host will appear under in the UI.

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: insightd-mqtt
    restart: unless-stopped
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - ./passwd:/mosquitto/config/passwd:ro
      - mosquitto-data:/mosquitto/data
    ports:
      - "1883:1883"

  hub:
    image: andreas404/insightd-hub:latest
    container_name: insightd-hub
    restart: unless-stopped
    depends_on: [mosquitto]
    ports:
      - "3000:3000"
    volumes:
      - hub-data:/data
    environment:
      INSIGHTD_MQTT_URL: mqtt://mosquitto:1883
      INSIGHTD_MQTT_USER: insightd
      INSIGHTD_MQTT_PASS: CHANGEME

  agent:
    image: andreas404/insightd-agent:latest
    container_name: insightd-agent
    restart: unless-stopped
    depends_on: [mosquitto]
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /:/host:ro
    environment:
      INSIGHTD_HOST_ID: hub-server
      INSIGHTD_MQTT_URL: mqtt://mosquitto:1883
      INSIGHTD_MQTT_USER: insightd
      INSIGHTD_MQTT_PASS: CHANGEME
      INSIGHTD_ALLOW_UPDATES: "true"
      INSIGHTD_ALLOW_ACTIONS: "true"

volumes:
  mosquitto-data:
  hub-data:
```

:::note
`INSIGHTD_ALLOW_ACTIONS` lets you start/stop/restart containers from the UI, and `INSIGHTD_ALLOW_UPDATES` lets the hub self-update the agent. Drop those two lines if you prefer read-only monitoring.
:::

## Step 4 — Start the stack

```bash
docker compose up -d
```

Watch the logs until the hub reports it is listening on port 3000:

```bash
docker compose logs -f hub
```

Press `Ctrl+C` to detach.

## Step 5 — Finish setup in the browser

Open `http://<your-server>:3000`. The **Setup Wizard** walks you through:

1. **Admin password** — protects the Settings and Webhooks pages. Skippable, but recommended.
2. **Email (SMTP)** — for the weekly digest and real-time alerts. Skippable; configurable later from **Settings → Email**.
3. **Add agent** — you've already started one in Compose, so click **Skip**.
4. **Waiting** — the hub waits to see the agent report in. First metrics arrive within 5 minutes.

Once the wizard is done the dashboard opens. Give it one collection cycle (5 minutes) to populate.

## Monitoring additional hosts

Everything about adding more hosts happens in the UI:

1. In the hub, open **Add Agent** from the sidebar.
2. Enter a host ID and click through — the page renders a ready-to-run `docker run` command with your MQTT URL, username, and password pre-filled.
3. Copy it, SSH to the target host (where Docker is installed), paste, run.
4. Within a few minutes the new host appears on the **Hosts** page with its containers listed.

For **Kubernetes / k3s** clusters, follow the [Kubernetes guide](/guides/kubernetes/) — the agent runs there as a DaemonSet instead of a Docker container, but it talks to the same hub and broker.

## Everything else lives in Settings

Open **Settings** in the sidebar after login. Every feature below is configured there, most of them hot-reloadable (no restart needed):

- **Email** — SMTP host/port/user/password, digest recipient, alert recipient.
- **Alerts** — enable/disable each alert type (container down, unhealthy, restart loop, host CPU/memory/load, disk, endpoints), thresholds, reminder backoff, exclude patterns.
- **Webhooks** — Slack, Discord, Telegram, ntfy, generic. Managed on the dedicated **Webhooks** page with a "Test" button for each channel.
- **AI Diagnosis** — paste a free [Gemini API key](https://aistudio.google.com/apikey) to enable per-container "Diagnose with AI".
- **Storage** — raw-data and rollup retention, manual **Vacuum Now** button, live database size.
- **Status Page** — opt-in public status page at `/status`.
- **General** — timezone, collection interval, hub base URL (used by email links).

You can also set most of these via environment variables in `docker-compose.yml` — see the [Configuration reference](/reference/config/).

## Upgrading

```bash
cd ~/insightd
docker compose pull
docker compose up -d
```

Compose restarts the hub and agent with the new images. Your data (`hub-data` and `mosquitto-data` volumes) is preserved. The hub also offers one-click self-updates and per-agent updates from the **Updates** page in the UI.

## Troubleshooting

- **Agent never shows up on the Hosts page.** The two most common causes: the MQTT passwords don't match (recheck `INSIGHTD_MQTT_PASS` in both services), or a firewall is blocking port `1883` between the agent host and the hub host. Agents log their MQTT connection state — `docker logs insightd-agent` tells you which.
- **Hub container won't start — port 3000 in use.** Change the port mapping to something else (e.g. `"3001:3000"`).
- **Wizard's "Waiting for agent" step hangs.** Agents collect every 5 minutes and publish on success. Press **Skip**; the host appears on the Hosts page shortly after.
- **Need to reset the setup wizard?** Delete the `hub-data` volume (`docker compose down && docker volume rm insightd_hub-data && docker compose up -d`). This **wipes all data** — metrics, alerts, settings — so only do this during initial setup.
