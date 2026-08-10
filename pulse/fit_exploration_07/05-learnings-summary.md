# Learnings Summary

## Queue/Drain Result

`signal.delivery_decided: deliver` is not enough to reconstruct when the model saw the signal.

Recommended mapping:

- emit `signal.delivery_decided` for routing
- emit `signal_queue.enqueued` when delivery queues a signal for later context entry
- emit `signal.drained_to_context` or `content.introduced` when the signal enters transcript/model context
- distinguish `scope: 'pre-run'` from `scope: 'pending'`

Pre-run signals are folded into the first model request. Pending signals become their own later model turn and force continuation.

## Abort Result

Abort is not an Agent Signal.

Recommended mapping:

- `abort_requested` for user/system run or thread cancellation request
- `abort_intent_recorded` when abort targets a run that has not prepared yet
- `abort_propagated` for cross-boundary or delayed propagation
- `abort_observed` when model/tool/workflow execution changes behavior due to cancellation
- `abort_completed` when run state/finalization records cancellation

Use `surface: run_control`, `thread_control`, `model`, `tool`, or `execution`.

Do not use:

- top-level `Signal` export
- `surface: signal` for `AbortSignal`
- content refs
- `SnapshotPulse`
- error Pulse for expected AbortError under an already-aborted signal

## Impact On Current Model

The current export model still holds:

```ts
type PulseExport =
  | Pulse
  | Relationship;
```

Queue/drain strengthens the need for explicit context-order relationships or sequence metadata.

Abort strengthens the need for a small control surface vocabulary:

- `run_control`
- `thread_control`
- possibly `execution`

## Candidate Relationships

High-confidence:

- `queued_signal`
- `drained_signal`
- `aborted_run`

Candidate / maybe redundant:

- `abort_requested_for`
- `abort_propagated_to`
- `signal_queue_moved`

## Residual Risk

The main remaining risk is vocabulary.

`signal.drained_to_context` is accurate but signal-specific. `content.introduced` is more general but hides the queue/drain behavior. A spec may need both: a content Pulse with `surface: signal` and `action: drained_to_context`, plus `introduced_content` relationship.

