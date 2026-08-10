# Shape Fit Rules

## Queue/Drain Rule

Signal delivery and model-context entry are separate facts.

Use:

- `ObservationPulse(signal.delivery_decided)` for routing/policy
- `ChangePulse(signal_queue.enqueued)` when a signal is queued for later model input
- `ObservationPulse(signal.drained_to_context)` or `ObservationPulse(content.introduced)` when the queued signal enters transcript/model context
- relationships from delivery decision to queue entry and from queue drain to content

Do not treat the delivery decision Pulse as the owner of signal content when the model does not see the signal until a later drain.

## Pre-Run Versus Pending

Pre-run signals and pending signals are different.

Pre-run:

- queued before the first model request
- folded into the first request
- may share the Flow origin/input boundary

Pending:

- queued while an active/blocking run is in progress
- drained after an iteration
- forces continuation / a new model turn

These should differ by `attributes.scope` at minimum:

```ts
attributes: {
  scope: 'pre-run' | 'pending'
}
```

If readers need distinct actions, use:

- `signal_queue.pre_run_drained`
- `signal_queue.pending_drained`

## Abort Rule

Abort is cancellation/control, not Agent Signal content.

Use `surface: 'run_control'`, `surface: 'thread_control'`, or `surface: 'execution'`, not `surface: 'signal'`.

Candidate actions:

- `abort_requested`
- `abort_propagated`
- `abort_observed`
- `abort_completed`

## Abort Emission Boundary

Do not emit for every `abortSignal` forwarded into a function.

Emit when:

- user/system requests abort for a run or thread
- runtime propagates abort across process/thread ownership boundaries
- execution observes abort and changes behavior
- final run/step state records cancellation

Skip:

- local plumbing of an already-known `AbortSignal`
- repeated checks that do not change behavior
- AbortError details when the abort was expected and already represented

## Snapshot Rule

No `SnapshotPulse` is needed for queue/drain or abort.

Queue state and abort state are bounded control state and can be represented with ChangePulses and read indexes.

