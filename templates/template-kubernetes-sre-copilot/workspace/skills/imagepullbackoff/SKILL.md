---
name: imagepullbackoff
description: Diagnostic checklist for Pods stuck in ImagePullBackOff / ErrImagePull
version: 1.0.0
metadata:
  tags:
    - kubernetes
    - pod-failure
    - imagepullbackoff
---

# ImagePullBackOff

The kubelet can't pull the container image the Pod spec references. This is almost always one
of three things: a bad reference, an unreachable registry, or missing/wrong pull credentials.
The diagnostic job is to figure out which one from the event message text — it's usually explicit.

## Diagnostic Checklist

1. **Check the image reference on the Pod spec.** Look at `spec.containers[].image` for each
   container (don't forget `initContainers`). Common mistakes: typo'd tag, a tag that was deleted
   from the registry, `:latest` pointing at nothing because it was never pushed, or a private
   registry hostname without the registry prefix.
2. **Fetch recent Events for the Pod.** The event message under `reason=Failed` or
   `reason=InspectFailed` almost always states the exact failure verbatim:
   - `"manifest unknown"` / `"not found"` — the tag or repo doesn't exist. Reference problem.
   - `"no such host"` / `"i/o timeout"` / `"connection refused"` — registry unreachable from the
     node (DNS, network policy, egress firewall, private registry with no route).
   - `"unauthorized"` / `"pull access denied"` / `"authentication required"` — credentials
     problem: missing, wrong, or expired `imagePullSecret`.
3. **Check for an `imagePullSecrets` entry** on the Pod spec (or on the Pod's ServiceAccount, if
   the Pod spec doesn't set one directly — Kubernetes falls back to the ServiceAccount's secrets).
   Its _absence_ combined with an `unauthorized` event message is close to conclusive for a
   private registry.
4. **Sanity-check reachability, if event text points to network.** `resources_list` for the
   node the Pod is scheduled on and check for `NetworkUnavailable`/`Ready` conditions — a
   node-level network problem produces this symptom across every Pod trying to pull an image on
   that node, not just this one.

## Classification Rule

State the specific sub-cause (bad reference vs. registry unreachable vs. missing/invalid
credentials) in `rootCause` — "can't pull the image" alone isn't a diagnosis, it's a restatement
of the symptom. The event message text is the primary evidence; quote it in `supportingData`.

## Confidence Guidance

- **High (0.8+):** Event message explicitly states the failure category (manifest unknown /
  unauthorized / no such host) and it's consistent with what you see on the Pod spec (e.g. no
  imagePullSecrets + "unauthorized").
- **Medium (0.4–0.79):** Event message is present but generic ("Failed to pull image"), and you're
  inferring the sub-cause from the image reference or secret presence alone.
- **Low (<0.4):** No usable event message text was retrievable — say so and recommend checking
  the node's container runtime logs directly (out of scope for this template's read tools).
