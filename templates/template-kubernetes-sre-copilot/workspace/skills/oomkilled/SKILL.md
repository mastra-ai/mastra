---
name: oomkilled
description: Diagnostic checklist for Pods killed by the OOM killer (exit code 137)
version: 1.0.0
metadata:
  tags:
    - kubernetes
    - pod-failure
    - oomkilled
---

# OOMKilled

The container exceeded its memory limit (or the node ran out of memory) and the kernel's OOM
killer terminated it. The diagnostic job is to confirm it really was memory, not a generic
SIGKILL, and to quantify the gap between what the workload needs and what it's allowed.

## Diagnostic Checklist

1. **Describe the Pod, check the terminated container state.** Confirm
   `lastState.terminated.exitCode == 137` **and** `reason == "OOMKilled"`. Exit code 137 alone is
   just "received SIGKILL" — the explicit `OOMKilled` reason field is what actually confirms this
   failure type rather than, say, a manual `kubectl delete pod --force` or a node-level eviction
   for a different reason. If `reason` isn't `OOMKilled`, reclassify.
2. **Fetch recent Events for the Pod.** Look for an `Evicted` event (node-pressure eviction,
   different from a container-level OOM kill — the node ran low on memory overall, not just this
   container exceeding its own limit) versus no eviction event (container-level cgroup limit hit,
   the more common case). This distinction changes the fix: container-level means raise this
   Pod's memory limit; node-level eviction means the node is oversubscribed and other Pods are
   competing for the same memory.
3. **Check the memory limit vs. actual usage.** Read `resources.limits.memory` and
   `resources.requests.memory` from the Pod spec. Where available, compare against recent usage
   (`pods_top` / `nodes_stats_summary`) — a container that's consistently running close to its
   limit before the kill is a strong confirming signal; a container killed while usage looks low
   suggests a sudden spike (e.g. batch job, large file load, memory leak building up between
   restarts) rather than a simply-undersized limit.
4. **Check restart pattern.** Repeated OOM kills at roughly the same wall-clock interval since
   Pod start often indicates a memory leak (usage climbs steadily until it hits the limit) rather
   than a one-time undersized limit for peak load.

## Classification Rule

`rootCause` must state both: (a) whether the limit itself is too low for the workload's genuine
peak usage, or the workload has a leak / unbounded growth pattern, and (b) the specific limit
value observed, so the recommendation in `suggestedFix` is a concrete number, not "increase
memory" with no target.

## Confidence Guidance

- **High (0.8+):** `reason: OOMKilled` confirmed on the terminated state, and usage-vs-limit data
  is available and consistent with the story.
- **Medium (0.4–0.79):** Exit code 137 confirmed but `reason` field or usage metrics weren't
  retrievable — evidence is consistent with OOM but not fully confirmed.
- **Low (<0.4):** Only the exit code is available; recommend the on-call SRE check
  `dmesg`/kubelet logs on the node directly (out of scope for this template's read tools) to
  confirm the OOM killer fired, rather than asserting it from exit code alone.
