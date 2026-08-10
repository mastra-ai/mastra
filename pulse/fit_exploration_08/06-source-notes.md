# Source Notes

## Durable Signal Drain Tests

`packages/core/src/agent/durable/__tests__/durable-agent-signal-drain.test.ts`

- pre-run signals queued before first model request are drained and appear as signal chunks.
- pending signals between iterations are drained and appear as signal chunks.
- pending signal drain can force the model to be called again even when it would have stopped.

Pulse implication:

- the signal entering context is not identical to the earlier delivery decision.
- forced continuation is a model-input reconstruction fact.

## Agent Signal Runtime Tests

`packages/core/src/agent/__tests__/agent-signals.test.ts`

Relevant cases:

- failed signal drain hands lease to a continuation and leaves failed signal queued.
- drained run losing its reserved lease discards local pre-run copies.
- follow-ups can attach to a continuation while its lease is reserved and later drain as pre-run.

Pulse implication:

- local queue state can be provisional.
- distributed handoff can change which run eventually owns visibility.
- replay needs failure/forward/discard facts when they affect whether a signal was consumed.

## MessageList

`packages/core/src/agent/message-list/message-list.ts`

Relevant behavior:

- `addSignal()` creates a signal transcript row.
- for input signal rows without acceptedAt metadata, it preserves accepted time and rewrites createdAt for insertion order.
- `generateCreatedAt()` ensures ordered additions get increasing timestamps.
- `markResponseMessageBoundary()` marks the prior assistant response as a boundary and source.
- message list sorts by `createdAt`.

Pulse implication:

- prompt order is a context-entry fact.
- original signal creation time is not enough.
- response boundaries need to be captured or derivable.

## Non-Durable Drain

`packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`

- pre-run signals are drained before the first model request.
- signal drain rotates current message id when pre-run signals exist.

`packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`

- pending signals are drained after an iteration.
- the prior response boundary is marked.
- message id is rotated.
- step result reason becomes `other`.
- `isContinued` becomes true.

Pulse implication:

- pending drain is both context entry and continuation control.

## Thread Runtime

`packages/core/src/agent/thread-stream-runtime.ts`

- `drainPendingSignals(runId, scope)` returns and clears one queue.
- pre-run leftover can be moved to pending.
- drain can forward a signal to a lease owner if local ownership is lost.

Pulse implication:

- queue movement and forwarding are relevant only when they change future visibility.

