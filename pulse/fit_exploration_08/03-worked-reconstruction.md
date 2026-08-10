# Worked Reconstruction

## Scenario A: Active Follow-Up

Runtime sequence:

1. run `run_1` is active.
2. signal `sig_1` is sent.
3. delivery resolves `deliver`.
4. signal is queued as `pending`.
5. current model iteration finishes.
6. signal drain marks prior response boundary, adds signal to MessageList, rotates message id, and sets `isContinued: true`.
7. next model request sees the signal.

Minimum Pulse facts:

```ts
Pulse(signal.delivery_decided, {
  signalId: 'sig_1',
  decision: 'deliver',
  runId: 'run_1'
})
```

```ts
ChangePulse(signal_queue.enqueued, {
  signalId: 'sig_1',
  scope: 'pending',
  runId: 'run_1'
})
```

```ts
Pulse(signal.drained_to_context, {
  signalId: 'sig_1',
  scope: 'pending',
  modelInputId: 'model_input_2',
  messageId: 'msg_2',
  forcedContinuation: true
})
```

Relationships:

- `queued_signal`: queue ChangePulse -> delivery Pulse
- `drained_signal`: drain Pulse -> queue ChangePulse
- `introduced_content`: drain Pulse -> signal content ref
- `included_in_model_input`: drain Pulse -> model input id
- `after_response_boundary`: drain Pulse -> previous assistant message id

Why delivery alone fails:

- replay would not know whether `sig_1` belonged to the current model input, next model input, or a later follow-up run.

## Scenario B: Pre-Run Signal

Runtime sequence:

1. run is reserved but not prepared.
2. signal `sig_2` is sent and accepted as `deliver`.
3. signal is queued as `pre-run`.
4. first model request drains `pre-run`.
5. first model input sees the signal.

Minimum Pulse facts:

```ts
Pulse(signal.delivery_decided, {
  signalId: 'sig_2',
  decision: 'deliver',
  target: 'reserved_run'
})
```

```ts
ChangePulse(signal_queue.enqueued, {
  signalId: 'sig_2',
  scope: 'pre-run'
})
```

```ts
Pulse(signal.drained_to_context, {
  signalId: 'sig_2',
  scope: 'pre-run',
  modelInputId: 'model_input_1',
  firstModelRequest: true
})
```

Why pending/pre-run cannot collapse:

- both have `deliver`, but one is first-request input and the other forces a later turn.

## Scenario C: Drain Failure With Continuation Handoff

Runtime sequence:

1. pending signal exists.
2. previous run finishes.
3. runtime tries to drain signal into a follow-up run.
4. stream fails.
5. continuation work takes the lease.
6. failed signal remains queued for later drain.

Minimum Pulse facts:

```ts
ChangePulse(signal_queue.drain_failed, {
  signalId: 'sig_3',
  scope: 'pending',
  reason: 'stream_start_failed'
})
```

```ts
ChangePulse(thread_control.lease_handed_to_continuation, {
  previousRunId: 'run_1',
  continuationRunId: 'run_2'
})
```

Why this matters:

- without `drain_failed`, replay may assume queued signal was consumed.
- without handoff state, replay may attach the signal to the continuation incorrectly.

## Scenario D: Drained Run Loses Lease

Runtime sequence:

1. runtime starts a drained run for queued signal.
2. another owner wins the lease.
3. local runtime forwards the signal and discards local pre-run copies.

Minimum Pulse facts:

```ts
Pulse(signal.delivery_forwarded, {
  signalId: 'sig_4',
  fromRunId: 'run_local',
  toRunId: 'run_winner',
  reason: 'lease_lost'
})
```

```ts
ChangePulse(signal_queue.local_copy_discarded, {
  signalId: 'sig_4',
  runId: 'run_local',
  reason: 'lease_lost'
})
```

Why this matters:

- local pre-run queue state cannot be interpreted as model-visible content.
- forwarding moves the future visibility boundary to the winner.

