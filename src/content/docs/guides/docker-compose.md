---
title: Docker Compose Setup
description: Multi-server monitoring with Mosquitto, Hub, and Agents
---

## Multi-Server Architecture

For monitoring multiple servers, insightd uses MQTT to connect lightweight agents to a central hub.

```
[Agent on host-1] ─┐
[Agent on host-2] ─┤→ MQTT (Mosquitto) → [Hub] → SQLite → Web UI
[Agent on host-3] ─┘
```

## Step 1: Create Configuration Files

### `.env`

```bash
# MQTT
INSIGHTD_MQTT_USER=insightd
INSIGHTD_MQTT_PASS=change-me-to-a-strong-password
INSIGHTD_HOST_ID=hub-server

# Web UI
INSIGHTD_ADMIN_PASSWORD=your-admin-password

# Email (optional)
INSIGHTD_SMTP_HOST=smtp.gmail.com
INSIGHTD_SMTP_PORT=587
INSIGHTD_SMTP_USER=you@gmail.com
INSIGHTD_SMTP_PASS=your-app-password
INSIGHTD_SMTP_FROM=you@gmail.com
INSIGHTD_DIGEST_TO=you@gmail.com

# Alerts
INSIGHTD_ALERTS_ENABLED=true
```

### `mosquitto.conf`

```
listener 1883
allow_anonymous false
password_file /mosquitto/config/passwd
persistence true
persistence_location /mosquitto/data/
```

### Generate MQTT password file

```bash
docker run --rm -v $(pwd):/out eclipse-mosquitto:2 \
  mosquitto_passwd -b -c /out/mosquitto-passwd insightd your-mqtt-password
```

## Step 2: Docker Compose (Hub Server)

### `docker-compose.yml`

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    container_name: insightd-mqtt
    restart: unless-stopped
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf:ro
      - ./mosquitto-passwd:/mosquitto/config/passwd:ro
      - mosquitto-data:/mosquitto/data
    ports:
      - "1883:1883"

  hub:
    image: andreas404/insightd-hub:latest
    container_name: insightd-hub
    restart: unless-stopped
    depends_on:
      - mosquitto
    ports:
      - "3000:3000"
    volumes:
      - hub-data:/data
    env_file:
      - .env
    environment:
      INSIGHTD_MQTT_URL: mqtt://mosquitto:1883

  agent:
    image: andreas404/insightd-agent:latest
    container_name: insightd-agent
    restart: unless-stopped
    depends_on:
      - mosquitto
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /:/host:ro
    environment:
      INSIGHTD_HOST_ID: ${INSIGHTD_HOST_ID:-hub-server}
      INSIGHTD_MQTT_URL: mqtt://mosquitto:1883
      INSIGHTD_MQTT_USER: ${INSIGHTD_MQTT_USER}
      INSIGHTD_MQTT_PASS: ${INSIGHTD_MQTT_PASS}
      INSIGHTD_ALLOW_UPDATES: "true"
      INSIGHTD_ALLOW_ACTIONS: "true"

volumes:
  mosquitto-data:
  hub-data:
```

```bash
docker compose up -d
```

## Step 3: Add Remote Agents

On each additional server, run the agent:

```bash
docker run -d \
  --name insightd-agent \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -v /:/host:ro \
  -e INSIGHTD_HOST_ID=my-server-name \
  -e INSIGHTD_MQTT_URL=mqtt://hub-server-ip:1883 \
  -e INSIGHTD_MQTT_USER=insightd \
  -e INSIGHTD_MQTT_PASS=your-mqtt-password \
  andreas404/insightd-agent:latest
```

:::tip
You can generate this command from the web UI: go to **Add Agent** in the sidebar. All 15 agent environment variables are configurable there, including collection interval, timezone, disk thresholds, and log limits.
:::

## Verify

1. Open **http://hub-server:3000**
2. Navigate to **Hosts** — you should see all connected hosts
3. Each host shows its containers, metrics, and disk usage
4. Data appears within 5 minutes (the default collection interval)
