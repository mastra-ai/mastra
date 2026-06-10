---
'@mastra/core': minor
---

Added native tool replay to dataset experiments. Experiments with agent targets can now replay tool outputs recorded in a prior traced run instead of executing live tools, so evals of agents with side-effecting tools become deterministic and side-effect free (GitHub issue #17466).

```typescript
// Record: any traced run works — experiments already store a traceId per item result
const baseline = await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
});

// Replay: tool calls return the recorded outputs, no live tools run
const replayed = await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  toolReplay: { fromExperimentId: baseline.experimentId },
});
```

**How it works**

- Recorded tool calls are matched per tool in their original order, so repeated calls to the same tool replay correctly. Recorded errors are re-thrown so the agent sees the same failure.
- `onMiss` controls what happens when the agent makes a call with no recorded event left: `'error'` (default) fails the item without retries, `'passthrough'` runs the call live.
- An item with no recording at all fails with `TOOL_REPLAY_NO_RECORDING` regardless of `onMiss` — replay never runs an item silently live. This also applies when the source trace was purged or not yet exported.
- Each item result includes a `toolReplay` divergence report (replayed count, misses, unconsumed events, argument mismatches, plus `redactedPayloadCount` and `staleRecording` recording-quality signals) — useful for studying how agent behavior drifts between runs. The report persists for failed items too, and stays out of the output scorers evaluate, so replay runs score the same way as baselines.
- Experiments that ran with replay are stamped with a `toolReplay` marker in their metadata, so stored replay runs are distinguishable from live runs.
- Per-item recordings can also be pinned explicitly with `replayTraceId` on inline data items or `metadata.replayTraceId` on stored items. When using `fromExperimentId` with inline data, give items explicit `id`s.

Agent targets only in this release; tools inside sub-agents are not intercepted.
