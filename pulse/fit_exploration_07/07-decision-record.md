# Decision Record

## Decision 1: Queue/Drain Is Explicit When Context Entry Is Delayed

Emit queue/drain facts when a signal is delivered before it becomes model-visible.

Accepted shape:

- delivery decision Pulse
- queue ChangePulse
- drain/content Pulse
- relationships connecting them

Why:

- delivery can occur in one run/iteration while model visibility occurs later.
- pre-run and pending signals affect context order differently.
- reconstructing the full message array from Pulses requires the drain/content boundary.

## Decision 2: Pre-Run And Pending Are Distinct

Represent with `attributes.scope` at minimum:

- `pre-run`
- `pending`

Pre-run signals are part of the first model request. Pending signals create a later model turn and force continuation.

## Decision 3: Abort Is Control, Not Agent Signal

Abort should not be modeled as Agent Signal content.

Accepted surfaces:

- `run_control`
- `thread_control`
- `execution`
- `model`
- `tool`

Accepted actions:

- `abort_requested`
- `abort_intent_recorded`
- `abort_propagated`
- `abort_observed`
- `abort_completed`

## Decision 4: Expected Abort Is Not Error

If an AbortError occurs while the abort signal is set, model it as expected cancellation, not an error Pulse.

Reason:

- source intentionally debug-logs this path and emits abort/final cancellation state.
- treating expected cancellation as error would pollute monitoring and replay semantics.

## Decision 5: No SnapshotPulse

Queue/drain and abort do not require SnapshotPulse.

Read indexes may materialize active queues, run control state, and final run status.

