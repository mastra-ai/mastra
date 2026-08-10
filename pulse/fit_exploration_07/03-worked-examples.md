# Worked Examples

## 1. Active Follow-Up Signal

Runtime:

- active same-agent run exists
- `sendSignal()` returns `deliver`
- signal is queued in `pendingSignalsByThread`
- `signalDrainStep` drains it after the current iteration and sets `isContinued: true`

Pulse mapping:

```ts
{
  type: 'decision',
  surface: 'signal',
  action: 'delivery_decided',
  attributes: {
    decision: 'deliver',
    target: 'active_run'
  }
}
```

```ts
{
  type: 'state',
  surface: 'signal_queue',
  action: 'enqueued',
  attributes: {
    scope: 'pending'
  }
}
```

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'drained_to_context',
  attributes: {
    scope: 'pending',
    forcedContinuation: true
  }
}
```

Relationships:

- `queued_signal` from queue ChangePulse to delivery decision Pulse
- `introduced_content` from drain/content Pulse to signal content ref
- `next_context_item` or sequence metadata to place the signal in model input order

## 2. Pre-Run Signal

Runtime:

- run is reserved but has not made first model request
- signal is queued with `preRun: true`
- first LLM request drains `pre-run` scope and folds the signal into the first request

Pulse mapping:

```ts
{
  type: 'state',
  surface: 'signal_queue',
  action: 'enqueued',
  attributes: {
    scope: 'pre-run'
  }
}
```

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'drained_to_context',
  attributes: {
    scope: 'pre-run',
    firstModelRequest: true
  }
}
```

Decision:

- content owner is the drain/content Pulse, not the enqueue Pulse.
- if the pre-run signal is also the Flow origin input, the origin Pulse can be the content Pulse.

## 3. Leftover Pre-Run Signals

Runtime:

- a run errors or finishes before its first model request drains pre-run signals
- runtime moves leftover pre-run signals into pending queue

Pulse mapping:

```ts
{
  type: 'state',
  surface: 'signal_queue',
  action: 'moved',
  attributes: {
    from: 'pre-run',
    to: 'pending',
    reason: 'first_request_not_reached'
  }
}
```

Why this matters:

- without this ChangePulse, replay may assume the signal was part of the failed run's first request.

## 4. Abort Thread With Local Prepared Run

Runtime:

- `abortThread()` finds active run
- prepared run exists
- `abortRun()` aborts internal controller and publishes `run-aborted`

Pulse mapping:

```ts
{
  type: 'decision',
  surface: 'thread_control',
  action: 'abort_requested',
  attributes: {
    target: 'thread',
    resolvedRunId: 'run_123'
  }
}
```

```ts
{
  type: 'state',
  surface: 'run_control',
  action: 'abort_completed',
  attributes: {
    runId: 'run_123'
  }
}
```

No content refs.

## 5. Abort Reserved Run Before Preparation

Runtime:

- `abortThread()` targets a reserved local run that has not prepared
- `abortRun()` stores run id in `abortedRunIds`
- `prepareRunOptions()` later sees the id and aborts before start

Pulse mapping:

```ts
{
  type: 'state',
  surface: 'run_control',
  action: 'abort_intent_recorded',
  attributes: {
    runId: 'run_123',
    reason: 'run_not_prepared'
  }
}
```

```ts
{
  type: 'state',
  surface: 'run_control',
  action: 'abort_propagated',
  attributes: {
    runId: 'run_123',
    boundary: 'prepare_run_options'
  }
}
```

## 6. Model Abort Observed

Runtime:

- streaming loop sees `abortSignal.aborted`
- stops collecting chunks
- emits abort chunk / calls `onAbort`
- does not treat AbortError as ordinary error

Pulse mapping:

```ts
{
  type: 'state',
  surface: 'model',
  action: 'abort_observed',
  attributes: {
    runId: 'run_123',
    expected: true,
    stoppedChunkCollection: true
  }
}
```

This is not `level: error`.

## 7. Tool Abort Observed

Runtime:

- tool execution throws while abort signal is set
- tool step returns `{ aborted: true }`
- mapping leaves call incomplete

Pulse mapping:

```ts
{
  type: 'state',
  surface: 'tool',
  action: 'abort_observed',
  attributes: {
    toolName: 'example_tool',
    toolCallId: 'call_123',
    leavesIncomplete: true
  }
}
```

