---
title: Kubernetes / k3s Setup
description: Deploy the insightd agent as a DaemonSet on Kubernetes or k3s
---

The insightd agent runs as a **DaemonSet** in Kubernetes — one pod per node. Each agent only sees pods on its own node, and reports its node as a "host" to the hub. Each pod's containers appear in the dashboard.

## Prerequisites

- A Kubernetes or k3s cluster
- An MQTT broker reachable from the cluster (your hub stack)
- `kubectl` configured against your cluster

## Step 1: Deploy the hub somewhere

The hub doesn't need to run inside the cluster — it just needs an MQTT broker the agents can reach. You can run it as a separate Docker container, in another cluster, or anywhere else. See the [Docker Compose guide](/insightd.dev/guides/docker-compose/) for the hub setup.

## Step 2: Edit the DaemonSet manifest

Download `agent/k8s/daemonset.yaml` from the [insightd repo](https://github.com/goldenproductions/insightd/tree/main/agent/k8s) and set your MQTT broker URL:

```yaml
- name: INSIGHTD_MQTT_URL
  value: mqtt://your-broker.example.com:1883
```

## Step 3: Optional MQTT credentials

If your broker requires authentication, create a secret:

```bash
kubectl create namespace insightd
kubectl create secret generic insightd-mqtt \
  --namespace insightd \
  --from-literal=username=insightd \
  --from-literal=password=yourpassword
```

The DaemonSet manifest already references this secret with `optional: true` so it's safe even if you skip this step.

## Step 4: Apply the manifests

```bash
kubectl apply -f https://raw.githubusercontent.com/goldenproductions/insightd/main/agent/k8s/rbac.yaml
kubectl apply -f https://raw.githubusercontent.com/goldenproductions/insightd/main/agent/k8s/daemonset.yaml
```

## Step 5: Verify

```bash
kubectl get pods -n insightd
kubectl logs -n insightd -l app=insightd-agent
```

You should see one agent pod per node, with logs like:

```
Detected Kubernetes environment (running in-cluster)
Connected to cluster — node my-node-01 is Ready
Collected 12 containers on node my-node-01
```

Open your hub UI — you'll see one host per node, with all the pods on that node listed as containers.

## What you'll see in the UI

- **One host per node**, named after the node
- **Each pod's containers** appear as containers under that host
- **Container names** use the format `{namespace}/{pod-name}/{container-name}`
- **CPU/memory metrics** from the kubelet's cAdvisor endpoint
- **Restart count** directly from the pod status
- **Logs** via the Kubernetes API
- **k8s badge** next to the host name in the host detail page

## What's not supported in k8s mode

- **Container actions** (start/stop/restart/remove) — these would require managing pods/deployments, which is the cluster's job
- **Image update checks** — Kubernetes manages image updates via deployments and rollouts; checking digests against Docker Hub is not meaningful in this context

If you need to perform actions or check image updates, use the Docker runtime mode for those hosts.

## RBAC permissions

The DaemonSet uses a ServiceAccount with these read-only cluster permissions:

- `pods` and `pods/log` — get, list, watch (to discover pods on the node and read logs)
- `nodes` — get, list (to verify the node exists at startup)
- `nodes/metrics`, `nodes/stats`, `nodes/proxy` — get (to query the kubelet's cAdvisor endpoint)

The agent never modifies anything in the cluster.

## Custom kubelet URL

By default the agent talks to `https://${NODE_IP}:10250`. If your kubelet listens on a different port or you need to override the URL, set `INSIGHTD_KUBELET_URL` in the DaemonSet env vars.

## Standalone (non-DaemonSet) mode

You can also run the agent outside the cluster pointing at a kubeconfig. Set `INSIGHTD_RUNTIME=kubernetes` and `NODE_NAME` to the node you want to monitor. The agent will use the default kubeconfig (`~/.kube/config` or `KUBECONFIG` env var) to authenticate. This mode is mainly useful for development and testing — for production, use the DaemonSet.
