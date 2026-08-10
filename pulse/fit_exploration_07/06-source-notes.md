# Source Notes

## Thread Runtime Queueing

`packages/core/src/agent/thread-stream-runtime.ts`

- `pendingSignalsByThread` stores active-run follow-up signals.
- `preRunSignalsByThread` stores signals queued before the run's first model request.
- `pendingIdleSignalsByThread` stores idle-start requests waiting for the active owner to clear.
- `drainPendingSignals(runId, scope)` returns and clears either pending or pre-run queue.
- `#drainPendingSignals()` can move pre-run leftovers into pending queue if a run finishes before first request.
- drain may transfer lease from previous run or forward the signal to the current lease owner.

## Non-Durable Drain

`packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`

- before first model request, drains `scope: 'pre-run'`.
- adds each signal to `MessageList`.
- emits signal data parts.
- rotates response message id when needed.

`packages/core/src/loop/workflows/agentic-execution/signal-drain-step.ts`

- drains default `pending` scope.
- marks response boundary.
- adds signals to message list.
- sets `reason: 'other'` and `isContinued: true`.

## Durable Drain

`packages/core/src/agent/durable/workflows/steps/llm-execution.ts`

- first durable model request drains `pre-run`.
- emits signal data parts via pubsub.

`packages/core/src/agent/durable/workflows/steps/signal-drain.ts`

- drains pending signals.
- updates serialized message list state.
- sets `isContinued: true`.
- best-effort: if drain throws, queued signals remain queued.

## Abort Runtime

`packages/core/src/agent/thread-stream-runtime.ts`

- `prepareRunOptions()` creates internal abort controller and wires upstream abort.
- `abortRun()` aborts prepared runs or records aborted id for later.
- `abortThread()` resolves active run and handles local, reserved, or remote owner cases.
- remote abort uses `run-abort-requested`.
- successful local abort publishes `run-aborted`.

## Abort In Execution

`packages/core/src/loop/workflows/agentic-execution/llm-execution-step.ts`

- stream loop checks `abortSignal.aborted` before processing chunks.
- abort under AbortError produces debug log and abort chunk, not error-level failure.
- if provider keeps streaming after abort, normal completion path still detects `abortSignal.aborted`.

`packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts`

- if tool throws while abort signal is set, returns `{ aborted: true }`.
- this avoids faking tool success or recording a misleading failure.

## Durable Abort

`packages/core/src/agent/durable/abort-transport.ts`

- remote abort listener flips a registry-owned AbortController.
- placeholder registry entries can be created so early worker steps are not deaf to remote abort.

`packages/core/src/agent/durable/workflows/steps/llm-execution.ts`

- early aborted signal returns clean output with reason `abort`.
- AbortError or aborted signal stops fallback/retry behavior.

