---
title: Kubernetes / k3s Setup
description: Deploy the insightd agent as a DaemonSet on Kubernetes or k3s
---

On Kubernetes / k3s the insightd agent runs as a **DaemonSet** — one pod per node — reporting to the same hub and Mosquitto broker you set up in the [Quick Start](/guides/quick-start/). Each agent only sees pods on its own node and reports that node as a "host"; each pod's containers appear in the dashboard.

## Prerequisites

- A Kubernetes or k3s cluster
- A running hub + Mosquitto (from the [Quick Start](/guides/quick-start/)) reachable from the cluster
- `kubectl` configured against your cluster

## Step 1: Confirm the hub is reachable

The hub doesn't need to run inside the cluster — the agents just need to reach its Mosquitto broker on port `1883`. If you haven't set the hub up yet, follow the [Quick Start](/guides/quick-start/) first.

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

## GitOps with Argo CD

If you already manage your cluster with [Argo CD](https://argo-cd.readthedocs.io/), you can drop the agent into your GitOps repo instead of `kubectl apply`-ing it by hand. A complete working example lives in [goldenproductions/monitoring#1](https://github.com/goldenproductions/monitoring/pull/1) — the files below mirror that PR.

### Repo layout

```
clusters/<cluster-name>/
  argocd/apps/
    observability-insightd-agent.yaml   # Argo CD Application
  observability/insightd-agent/
    kustomization.yaml
    serviceaccount.yaml
    rbac.yaml
    daemonset.yaml
    config.env                          # mqttUrl + hostGroup (committed)
```

### `observability/insightd-agent/kustomization.yaml`

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
namespace: insightd
resources:
  - serviceaccount.yaml
  - rbac.yaml
  - daemonset.yaml
configMapGenerator:
  - name: insightd-agent-config
    envs:
      - config.env
generatorOptions:
  disableNameSuffixHash: true
```

### `observability/insightd-agent/config.env`

```env
mqttUrl=mqtt://your-hub.lan:1883
hostGroup=my-cluster
```

### `observability/insightd-agent/daemonset.yaml`

Copy [`agent/k8s/daemonset.yaml`](https://github.com/goldenproductions/insightd/blob/main/agent/k8s/daemonset.yaml) from the insightd repo and change two env sources to pull from the generated ConfigMap:

```yaml
- name: INSIGHTD_HOST_GROUP
  valueFrom:
    configMapKeyRef:
      name: insightd-agent-config
      key: hostGroup
- name: INSIGHTD_MQTT_URL
  valueFrom:
    configMapKeyRef:
      name: insightd-agent-config
      key: mqttUrl
```

Pin the image to a specific version — k8s-mode agents cannot self-update via MQTT, so you roll them forward by bumping the tag in git:

```yaml
image: andreas404/insightd-agent:0.13.0
imagePullPolicy: IfNotPresent
```

### `argocd/apps/observability-insightd-agent.yaml`

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: observability-insightd-agent
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/YOUR_ORG/YOUR_REPO.git
    targetRevision: HEAD
    path: clusters/<cluster-name>/observability/insightd-agent
  destination:
    server: https://kubernetes.default.svc
    namespace: insightd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
      - ServerSideApply=true
```

### MQTT credentials (out-of-band)

Don't commit the broker password — create the Secret against the cluster once:

```bash
kubectl create secret generic insightd-mqtt \
  --namespace=insightd \
  --from-literal=username=insightd \
  --from-literal=password=YOUR_PASSWORD
```

The DaemonSet references this Secret with `optional: true`, so skip it entirely if your broker is anonymous.

### Rolling forward

Bump `image:` in `daemonset.yaml` and merge — Argo CD reconciles and the DaemonSet rolls out. No `kubectl` needed after the initial Secret.

## What you'll see in the UI

- **One host per node**, named after the node
- **Each pod's containers** appear as containers under that host
- **Container names** use the format `{namespace}/{pod-name}/{container-name}`
- **CPU/memory metrics** from the kubelet's cAdvisor endpoint
- **Restart count** directly from the pod status
- **Logs** via the Kubernetes API
- **k8s badge** next to the host name in the host detail page

## Namespace filtering

Kubernetes clusters come with many system services (`kube-system`, `kube-proxy`, `coredns`, `metrics-server`, etc.) that you may not care about monitoring. The host detail page for k8s nodes includes a **namespace filter bar** above the uptime timeline:

- **Toggle chips** for each namespace — click to hide/show
- Applies to both the **Uptime (7 days)** timeline and the **Containers** table
- Hidden namespaces are **persisted per host** in your browser (localStorage)
- All namespaces are visible by default — click to hide what you don't need
- A **"Show all"** link appears when filtering is active, showing how many containers are hidden

For example, if you only care about your workloads in `default` and `monitoring`, click `kube-system` to hide all the system pods. The filter remembers your choice across page refreshes.

The namespace prefix is also **dimmed** in the container name column so the pod/container name stands out.

:::note
The namespace filter only appears on Kubernetes hosts. Docker hosts are unaffected.
:::

## What's not supported in k8s mode

- **Container actions** (start/stop/restart/remove) — managing pods is the cluster's job, not the hub's. Setting `INSIGHTD_ALLOW_ACTIONS=true` has no effect; the agent will log a warning at startup if you set it. The container detail page renders Start/Stop/Restart disabled with a tooltip on k8s hosts.
- **Image update checks and remote updates** — Kubernetes manages image updates via deployments and rollouts; checking digests against Docker Hub is not meaningful in this context. Setting `INSIGHTD_ALLOW_UPDATES=true` has no effect; the agent will log a warning at startup if you set it. The Updates page shows k8s agents with a "Managed by cluster" label instead of an Update button.

If you need to perform actions or check image updates, use the Docker runtime mode for those hosts.

## RBAC permissions

The DaemonSet uses a ServiceAccount with these read-only cluster permissions:

- `pods` and `pods/log` — get, list, watch (to discover pods on the node and read logs)
- `nodes` — get, list (to verify the node exists, read capacity for total memory, read `creationTimestamp` for uptime)
- `nodes/metrics`, `nodes/stats`, `nodes/proxy` — get (to query the kubelet's `/metrics/cadvisor` and `/stats/summary` endpoints)
- `replicasets` (apps API group) — get, list (to walk pod owner references up to the parent Deployment so containers keep a stable name across rollouts)

The agent never modifies anything in the cluster.

## Custom kubelet URL

By default the agent talks to `https://${NODE_IP}:10250`. If your kubelet listens on a different port or you need to override the URL, set `INSIGHTD_KUBELET_URL` in the DaemonSet env vars.

## In-cluster only

The agent requires in-cluster service account credentials (mounted at `/var/run/secrets/kubernetes.io/serviceaccount/`) and the `KUBERNETES_SERVICE_HOST` env var that Kubernetes injects automatically. Running the agent outside the cluster pointing at a kubeconfig is **not supported** — use the DaemonSet.
