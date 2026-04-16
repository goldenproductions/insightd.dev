---
title: Quick Start
description: Install insightd with one copy-paste command
---

insightd runs as three containers managed by Docker Compose:

- **Mosquitto** — MQTT broker that connects agents to the hub.
- **Hub** — web UI, database, insights and diagnosis engine.
- **Agent** — collects metrics for one host. Run one per host you want to monitor.

To monitor one server, run all three on that server. To monitor ten, you run the same stack once and then add one more agent container on each additional host. That's the only difference.

## Prerequisites

- A Linux server with Docker Engine and the Compose plugin (`docker compose version` should report v2).
- Free TCP ports **3000** (web UI) and **1883** (MQTT). Keep `1883` on your LAN — don't expose it publicly.

## Install

```bash
curl -sSL https://insightd.org/install.sh | bash
```

That's it. The script:

1. Creates `~/insightd/` (override with `INSIGHTD_DIR=/opt/insightd`).
2. Downloads `docker-compose.hub.yml`.
3. Generates a strong random MQTT password with `openssl rand -hex 24` and writes it to `.env` (`chmod 600`).
4. Runs `docker compose up -d`, which starts a one-shot **bootstrap** container that materialises `mosquitto.conf` and a hashed `passwd` file into a named volume. Mosquitto, the hub, and a local agent start once the bootstrap exits.
5. Polls `http://localhost:3000/api/setup/status` and prints the dashboard URL when the hub is reachable.

Re-running the script is safe — existing `.env` is preserved so agents stay enrolled.

:::tip
The install script is ~70 lines of bash and [public on GitHub](https://github.com/goldenproductions/insightd.org/blob/main/public/install.sh). Audit or download it first if you prefer:

```bash
curl -fsSL https://insightd.org/install.sh -o install.sh
less install.sh
bash install.sh
```
:::

## Finish setup in the browser

Open the URL the installer printed (typically `http://<your-server>:3000`). The **Setup Wizard** walks you through:

1. **Admin password** — protects the Settings and Webhooks pages. Skippable, but recommended.
2. **Email (SMTP)** — for the weekly digest and real-time alerts. Skippable; configurable later from **Settings → Email**.
3. **Add agent** — the local agent is already running from the install script, so click **Skip**.
4. **Waiting** — first metrics arrive within 5 minutes (the default collection interval).

Once the wizard is done the dashboard opens.

## Monitoring additional hosts

Everything about adding more hosts happens in the UI:

1. In the hub, open **Add Agent** from the sidebar.
2. Enter a host ID and click through — the page renders a ready-to-run `docker run` command with your MQTT URL, username, and password pre-filled from `.env`.
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

You can also set most of these via environment variables in the hub's `environment:` block — see the [Configuration reference](/reference/config/).

## Manual install (without the script)

If you'd rather not run a remote script, do the three steps yourself:

```bash
mkdir -p ~/insightd && cd ~/insightd
curl -O https://raw.githubusercontent.com/goldenproductions/insightd/main/docker-compose.hub.yml
cat > .env <<EOF
INSIGHTD_MQTT_USER=insightd
INSIGHTD_MQTT_PASS=$(openssl rand -hex 24)
INSIGHTD_HOST_ID=hub-server
INSIGHTD_ALLOW_UPDATES=true
INSIGHTD_ALLOW_ACTIONS=true
EOF
chmod 600 .env
docker compose -f docker-compose.hub.yml up -d
```

The bootstrap container inside `docker-compose.hub.yml` handles everything that used to be manual (writing `mosquitto.conf`, running `mosquitto_passwd`). Supply your own `INSIGHTD_MQTT_PASS` in `.env` if you want to manage the credential yourself.

## Upgrading

```bash
cd ~/insightd
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d
```

Compose restarts the hub and agent with the new images. Your data (`hub-data` and `mosquitto-data` volumes) is preserved. The hub also offers one-click self-updates and per-agent updates from the **Updates** page in the UI.

## Troubleshooting

- **Agent never shows up on the Hosts page.** The two most common causes: the MQTT passwords don't match (recheck `INSIGHTD_MQTT_PASS` in both services), or a firewall is blocking port `1883` between the agent host and the hub host. Agents log their MQTT connection state — `docker logs insightd-agent` tells you which.
- **Hub container won't start — port 3000 in use.** Change the port mapping to something else (e.g. `"3001:3000"`) and re-run compose up.
- **Wizard's "Waiting for agent" step hangs.** Agents collect every 5 minutes and publish on success. Press **Skip**; the host appears on the Hosts page shortly after.
- **Need to reset the setup wizard?** Delete the `hub-data` volume (`docker compose down && docker volume rm insightd_hub-data && docker compose up -d`). This **wipes all data** — metrics, alerts, settings — so only do this during initial setup.
- **Lost your `.env`?** The password is only stored in `.env` and inside mosquitto's `passwd` volume. If you need to rotate, `docker compose down`, `docker volume rm insightd_mosquitto-config`, generate a new `.env`, then `docker compose up -d` — and re-enrol every remote agent with the new password from **Add Agent**.
