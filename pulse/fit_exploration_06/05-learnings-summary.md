# Learnings Summary

## Main Result

Agent Signals fit the current Pulse model without adding a new top-level export shape.

Recommended mapping:

- `CreatedAgentSignal` is a source object, not a Pulse export.
- signal routing policy resolution is a `signal.delivery_decided` `ObservationPulse` when it affects execution.
- signal content entering transcript/model context is an `ObservationPulse` that owns the content body.
- state signal tracking updates are `ChangePulse` records.
- notification inbox lifecycle updates are `ChangePulse` records.
- relationships connect signal Pulses to flows, threads, notification records, and state lanes.

## Answer To The Backlog Question

Question:

- Should signal handling emit a signal-arrival Pulse, a state-change Pulse, or one Pulse with both arrival and mutation semantics?

Answer:

- Do not emit a generic signal-arrival Pulse.
- Emit a content Pulse when the signal body enters context.
- Emit a delivery decision Pulse when routing behavior matters.
- Emit a ChangePulse when state tracking, notification records, queue state, or transcript state changes.
- Use relationships to connect those facts when both exist.

This avoids double-emitting the same fact while preserving distinct facts that happen at different moments.

## Strong Rules

- `createSignal()` alone does not emit.
- `data-signal` stream parts usually do not emit.
- state signal `mode: 'snapshot'` is not Pulse `SnapshotPulse`.
- skipped duplicate state signals do not introduce content.
- notification records are state; notification signals are content projections.

## Candidate New Relationship Types

High-confidence:

- `applies_state_signal`
- `updates_state_lane`
- `notification_signal_for`
- `summary_signal_for`

Lower-confidence:

- `signal_targeted_thread`
- `signal_targeted_run`
- `woke_flow`
- `delivered_to_flow`
- `persisted_to_thread`

The lower-confidence group may be replaceable with existing Flow/thread/content relationships plus attributes.

## Impact On Current Model

The current model remains:

```ts
type PulseExport =
  | Pulse
  | Relationship;
```

No `Signal` export is needed.

`ChangePulse` remains necessary because state signals and notification records mutate durable or logical state.

`SnapshotPulse` is not needed for Agent Signals.

## Residual Risk

The largest unresolved risk is naming. The implementation uses "accepted" for delivery-policy resolution, while Pulse probably needs to distinguish routing accepted from content accepted. A sloppy naming choice could reintroduce double-emission ambiguity.

