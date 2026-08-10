# Exploration Log

## 2026-08-10 - Queue/Drain Review

Read:

- `packages/core/src/agent/thread-stream-runtime.ts`
- `packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`
- `packages/core/src/agent/durable/workflows/steps/signal-drain.ts`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`
- `packages/core/src/agent/durable/workflows/steps/llm-execution.ts`

Findings:

- `sendSignal()` can queue signals into `preRunSignalsByThread`, `pendingSignalsByThread`, or `pendingIdleSignalsByThread`.
- pre-run signals are folded into the first model request.
- pending signals are drained by `signalDrainStep` after an iteration and force continuation as a new model turn.
- durable drain mirrors the non-durable drain and also sets `isContinued: true`.
- if a run finishes before pre-run signals are drained, leftover pre-run signals are moved into the follow-up pending queue.
- queue drain can acquire or transfer a thread lease; if it loses ownership it forwards the signal to the winner.

Shape pressure:

- `delivery_decided: deliver` is not sufficient to reconstruct model input order.
- pre-run and pending drains differ semantically enough to deserve different actions or attributes.
- the content owner should be the Pulse emitted when the signal enters transcript/model context, not the earlier delivery decision Pulse.

## 2026-08-10 - Abort Review

Read:

- `packages/core/src/agent/thread-stream-runtime.ts`
- `packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`
- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`
- `packages/core/src/agent/durable/abort-transport.ts`
- `packages/core/src/agent/durable/workflows/steps/llm-execution.ts`
- `packages/core/src/agent/durable/types.ts`

Findings:

- `prepareRunOptions()` creates an internal `AbortController` and wires upstream abort into it.
- `abortRun()` aborts a prepared run or records abort intent for a not-yet-prepared run.
- `abortThread()` aborts a local run directly, records intent for a reserved local run, or publishes `run-abort-requested` for a remote owner.
- runtime publishes `run-aborted` after aborting a run.
- model execution checks `abortSignal.aborted` while streaming to avoid accumulating chunks after disconnect.
- AbortError under an aborted signal is handled as expected cancellation, not an error.
- tool execution under an aborted signal returns an incomplete/aborted result rather than faking success.
- durable abort uses run registry state and remote abort listeners; abort state is intentionally non-serializable.

Shape pressure:

- abort is not an Agent Signal and should not use `surface: signal`.
- abort has request, propagation, observation, and completion phases.
- most `abortSignal` forwarding call sites are not Pulse-worthy by themselves.
- cancellation should be represented as control/run state, not content.

