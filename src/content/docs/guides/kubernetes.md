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
- **CPU/memory metrics** from the kubelet's cAdvisor endpoint, with **resource limits** parsed from each pod's spec — saturation alerts fire at 90% of memory limit and 75% of CPU limit
- **Restart count** directly from the pod status
- **Logs** via the Kubernetes API
- **k8s badge** next to the host name in the host detail page

## Cluster-wide observability

In addition to the per-node container view, the agents elect a leader (via a `coordination.k8s.io/Lease` in the `insightd` namespace) to publish cluster-scoped resources to the hub. Only one agent does this work, regardless of cluster size.

- **Cluster events** — Warning-level events from the apiserver land on the **Events** tab of any k8s host detail page (FailedScheduling, FailedMount, BackOff, Evicted, OOMKilled, …). Severe reasons get a red badge.
- **Node conditions** — `Ready`, `MemoryPressure`, `DiskPressure`, `PIDPressure` are read from each node and surfaced as badges on the host detail header. Pressure conditions auto-promote to alerts (`node_pressure`); `Ready != True` promotes to `node_not_ready` (critical).
- **PV / PVC inventory** — every PersistentVolume and PersistentVolumeClaim in the cluster appears on the **Storage** page under the **K8s PVs** tab. Phase, capacity, claim binding, storage class, and the CSI driver are all visible.
- **Ingress auto-discovery** — every Ingress in the cluster is surfaced on the **Endpoints** page under "Discovered ingresses". Click **monitor** to start polling that ingress as an HTTP endpoint (the URL is composed from the host + first non-`/` path; `https://` if the host appears in `spec.tls[].hosts[]`, else `http://`). Click **dismiss** to hide ingresses you don't care about. Both actions are reversible.

These features are k8s-only and have no Docker equivalent.

## Namespace filtering

Kubernetes clusters come with many system services (`kube-system`, `kube-proxy`, `coredns`, `metrics-server`, etc.) that you may not care about monitoring.

**Per-host filter bar** — the host detail page renders a chip row above the uptime timeline. Click a chip to hide that namespace; the choice is reflected in the URL as `?ns=ns1,ns2` so it survives reloads and shares cleanly. Hidden namespaces apply to both the **Uptime (7 days)** timeline and the **Containers** table, and the namespace prefix is dimmed in the container name column.

**Fleet-wide alerts filter** — the **Alerts** page has a `Namespace` facet in its rail. Tick one or more namespaces to narrow alerts to just those workloads; the URL gets `?namespaces=ns1,ns2`. The facet auto-hides on Docker-only fleets.

:::note
Both filters apply to Kubernetes targets only. Docker container alerts and Docker hosts are unaffected.
:::

## What's not supported in k8s mode

- **Container actions** (start/stop/restart/remove) — managing pods is the cluster's job, not the hub's. Setting `INSIGHTD_ALLOW_ACTIONS=true` has no effect; the agent will log a warning at startup if you set it. The container detail page renders Start/Stop/Restart disabled with a tooltip on k8s hosts.
- **Image update checks and remote updates** — Kubernetes manages image updates via deployments and rollouts; checking digests against Docker Hub is not meaningful in this context. Setting `INSIGHTD_ALLOW_UPDATES=true` has no effect; the agent will log a warning at startup if you set it. The Updates page shows k8s agents with a "Managed by cluster" label instead of an Update button.

If you need to perform actions or check image updates, use the Docker runtime mode for those hosts.

## RBAC permissions

The DaemonSet uses a ServiceAccount with these cluster permissions:

- `pods` and `pods/log` — get, list, watch (to discover pods on the node and read logs)
- `nodes` — get, list (to verify the node exists, read capacity for total memory, read `creationTimestamp` for uptime)
- `nodes/metrics`, `nodes/stats`, `nodes/proxy` — get (to query the kubelet's `/metrics/cadvisor` and `/stats/summary` endpoints)
- `replicasets`, `deployments`, `statefulsets`, `daemonsets` (apps API group) — get, list, watch. ReplicaSets are walked to resolve pod owner references up to the parent Deployment so containers keep a stable name across rollouts. The other three back the workload-rollout alerts (`workload_unavailable`, `workload_degraded`, `workload_rollout_stuck`) — the elected leader compares `spec.replicas` against `status.readyReplicas` and publishes the result for the hub to evaluate.
- `persistentvolumes`, `persistentvolumeclaims`, `services` — get, list, watch. PV/PVC inventory powers the Storage page's K8s PVs tab; Service inventory backs the topology view's Ingress→Service→Workload edges (real selector-based matching).
- `events` — get, list. The elected leader polls cluster-scoped Warning events and publishes them; they surface on the Events tab.
- `ingresses` (networking.k8s.io API group) — get, list. The elected leader publishes Ingress inventory to the hub for auto-discovery on the Endpoints page.

Namespace-scoped Role in `insightd` for leader election:

- `coordination.k8s.io/leases` — get, create, update, patch. Only one agent at a time publishes cluster-scoped resources, so the hub doesn't receive duplicates from every DaemonSet pod.

The agent reads cluster state only — the Lease is the only thing it writes, and it's confined to the agent's own namespace.

### Upgrading existing deployments

`agent-v0.17.0` added several rules at once: cluster Events, Ingress inventory, Service inventory, and the apps/v1 verbs that back the workload-rollout alerts. If you're upgrading from any earlier agent release, reapply the manifest after pulling the new image:

```bash
kubectl apply -f https://raw.githubusercontent.com/goldenproductions/insightd/main/agent/k8s/rbac.yaml
```

Without this, the corresponding leader-published features (cluster Events, ingress auto-discovery, topology Service edges, workload-rollout alerts) will silently fail with RBAC denial logs from the leader.

## Custom kubelet URL

By default the agent talks to `https://${NODE_IP}:10250`. If your kubelet listens on a different port or you need to override the URL, set `INSIGHTD_KUBELET_URL` in the DaemonSet env vars.

## In-cluster only

The agent requires in-cluster service account credentials (mounted at `/var/run/secrets/kubernetes.io/serviceaccount/`) and the `KUBERNETES_SERVICE_HOST` env var that Kubernetes injects automatically. Running the agent outside the cluster pointing at a kubeconfig is **not supported** — use the DaemonSet.
