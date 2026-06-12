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
- An item with no recording at all fails with `TOOL_REPLAY_NO_RECORDING` regardless of `onMiss`, without retries — replay never runs an item silently live. This also applies when the source trace was purged or not yet exported.
- `fromExperimentId` must reference a live experiment: replay runs record only synthetic tool spans (see below), which extraction ignores, so chaining a replay experiment as a recording source is rejected at setup. Tool spans that never completed (crashed or in-flight recording runs) are skipped instead of replaying empty outputs.
- Each item result includes a `toolReplay` divergence report (replayed count, misses, unconsumed events, argument mismatches, plus `redactedPayloadCount` and `staleRecording` recording-quality signals) — useful for studying how agent behavior drifts between runs. The report persists for failed items too, and stays out of the output scorers evaluate, so replay runs score the same way as baselines.
- Experiments that ran with replay are stamped with a `toolReplay` marker in their metadata, so stored replay runs are distinguishable from live runs.
- Per-item recordings can also be pinned explicitly with `replayTraceId` on inline data items or `metadata.replayTraceId` on stored items. When using `fromExperimentId` with inline data, give items explicit `id`s.

Agent targets only in this release; tools inside sub-agents are not intercepted.

**Synthetic tool spans.** Replayed and mocked calls never execute the real tool, so they would otherwise leave no tool spans and replay run traces would look empty. Each short-circuited call now records a synthetic tool span in the run's own trace, named like a live tool span and flagged in its metadata (`toolReplay: { synthetic: true, outcome: 'replayed' | 'mocked', sequence }`), so trace timelines stay readable and trajectory scorers see the run's tool steps. The flag marks a served recording or mock, not an execution, and replay extraction skips flagged spans — a replay run's trace can never serve as a recording, even when pointed at directly via `replayTraceId`. Hooks that short-circuit via `beforeToolCall` can attach outcome detail through the new optional `spanMetadata` field on the hook result.

**Matching policy.** `toolReplay.matching` selects how recorded events match the agent's calls: `'fifo'` (default) serves per-tool events in recorded order and reports argument drift in `argMismatches`; `'strict'` serves an event only on an exact args match — anything else is a miss, for contract-style tests where deviation must fail. Strict mode also treats the recording as a contract in the other direction: recorded calls left unconsumed fail the item with `TOOL_REPLAY_UNCONSUMED` (not retried), so an agent that stops calling an expected tool cannot pass silently. Tools answered by a suppressing mock are exempt from that contract — mocking the one drifting tool while staying strict everywhere else works as intended, and the report still lists the mocked tool's recorded calls under `unconsumed` as signal.

**Tool mocks.** `toolMocks` overrides individual tools without needing a recording, with or without `toolReplay`:

```typescript
await dataset.startExperiment({
  targetType: 'agent',
  targetId: 'support-agent',
  toolMocks: {
    weatherInfo: { output: { temp: 20 } }, // static stub
    paymentApi: { error: { message: 'timed out' } }, // failure injection
    createTicket: { output: { ok: true }, expect: { args: { priority: 'high' }, calledTimes: 1 } }, // assertion
    searchDocs: async ({ input }) => fakeIndex.search(input), // function mock (code-only)
  },
})
```

An unsatisfied `expect` fails the item with `TOOL_MOCK_EXPECTATION_FAILED`. Mock usage and expectation outcomes appear in the divergence report (`mocks`, `expectations`), and the report itself now persists in a dedicated `toolReplay` column on experiment results instead of riding inside the stored output. The report also includes `calls` — the run's tool-call flow in order, each entry telling whether the call was replayed, mocked, missed, or ran live.

Runs whose mocks suppress live execution (`output`/`error`/function mocks) are stamped with `metadata.toolReplay.mockedTools` and refused as replay sources; expect-only runs execute tools live and stay eligible. Mock keys that normalize to the same tool name are rejected at setup (`TOOL_MOCK_NAME_COLLISION`) instead of silently dropping one mock and its assertions.
