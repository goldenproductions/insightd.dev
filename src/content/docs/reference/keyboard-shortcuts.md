---
title: Keyboard Shortcuts
description: Keyboard shortcuts for navigating and acting on the insightd web UI
---

The insightd web UI has a small set of keyboard shortcuts for fast navigation and common actions. Press `?` from anywhere to see a help modal listing whatever shortcuts are currently active for the page you're on.

:::tip
Shortcuts are disabled while typing in a form field, and combinations carrying `Ctrl`, `Cmd`, or `Alt` always pass through to the browser — so `Ctrl+R` still reloads the page, `Cmd+F` still opens find, etc.
:::

## Global

Available on every page.

| Key | Action |
|---|---|
| `?` | Toggle the keyboard shortcut help modal |
| `g d` | Go to **D**ashboard |
| `g h` | Go to **H**osts |
| `g s` | Go to **S**tacks |
| `g e` | Go to **E**ndpoints |
| `g i` | Go to **I**nsights |
| `g a` | Go to **A**lerts |
| `g u` | Go to **U**pdates |
| `g ,` | Go to Settings |

The `g` prefix matches the convention used by vim, GitHub, and Linear. After pressing `g`, you have one second to follow up with the second key — otherwise the buffer clears and `g` becomes a no-op.

## Container detail

Available on `/hosts/:hostId/containers/:containerName`. The action shortcuts auto-disable when the container is stopped or the user is not authenticated.

| Key | Action |
|---|---|
| `r` | Restart container (opens the same confirm dialog as the button) |
| `s` | Stop container (opens confirm) |
| `1` | Switch to Overview tab |
| `2` | Switch to Logs tab |
| `3` | Switch to Alerts & history tab |
| `b` | Back to host detail |
| `[` | Previous container on the same host (alphabetical) |
| `]` | Next container on the same host (alphabetical) |

## Host detail

Available on `/hosts/:hostId`.

| Key | Action |
|---|---|
| `1` | Switch to Overview tab |
| `2` | Switch to Resources tab |
| `3` | Switch to Alerts tab |
| `b` | Back to hosts list |
| `[` | Previous host (alphabetical) |
| `]` | Next host (alphabetical) |

## Endpoint detail

Available on `/endpoints/:endpointId`.

| Key | Action |
|---|---|
| `b` | Back to endpoints list |
| `e` | Edit endpoint (requires authentication) |

## Dashboard

| Key | Action |
|---|---|
| `r` | Refresh the dashboard data (refetch all queries) |

## Alerts page

| Key | Action |
|---|---|
| `r` | Refresh the alerts list |

The Alerts page also has a per-section **Select** toggle button (top-right of each section card) that reveals row checkboxes and a bulk action toolbar — silence presets for active alerts, Clear for resolved alerts. See the [Alerts page guide](/reference/config/#alerts) for more on bulk operations.
