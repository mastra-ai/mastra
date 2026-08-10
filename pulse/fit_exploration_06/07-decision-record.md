# Decision Record

## Decision 1: No Signal Export

Do not add `Signal` to `PulseExport`.

Agent Signals are represented by Pulses, ChangePulses, and Relationships.

Reason:

- signal creation can be only validation/conversion.
- signal projection has multiple shapes: DB message, LLM message, stream data part.
- delivery policy can discard or skip a signal before it becomes context.
- adding `Signal` would duplicate content Pulses and state ChangePulses.

## Decision 2: Split Delivery From Content

Use separate facts when both matter:

- `ObservationPulse(signal.delivery_decided)` for routing decision
- `ObservationPulse(signal.accepted)` or `ObservationPulse(content.introduced)` for signal body entering context

Do not emit a generic "signal arrived" Pulse by default.

Reason:

- delivery can happen before model visibility.
- active runs queue signals for later drain.
- idle wake can make the signal the Flow origin.
- persist/discard decisions may not introduce model-visible content.

## Decision 3: State Signals Need ChangePulse

Accepted state signals should usually emit:

- signal content Pulse
- state tracking ChangePulse
- relationship connecting the two

Skipped unchanged state signals emit no content Pulse.

Reason:

- state signal tracking mutates thread metadata and versions a state lane.
- signal content and tracking mutation are distinct facts.
- state signal `snapshot` is a domain mode, not Pulse `SnapshotPulse`.

## Decision 4: Notification Records Stay State

Notification inbox records are state. Notification signals are content projections.

Use:

- `ChangePulse(notification_record.created|updated|delivered|summary_emitted)`
- signal content Pulse for full notification or notification summary
- relationships to notification record ids

## Decision 5: Queue Facts Are Selective

Do not make enqueue/drain Pulses mandatory for every signal.

Emit them when they explain a delayed or reordered model input:

- active run pending queue
- pre-run queue
- durable signal drain
- blocked/suspended thread behavior

## Current Answer

Agent Signals map without duplication by using this hierarchy:

1. routing decision Pulse if routing matters
2. content Pulse if the signal body enters transcript/model context
3. ChangePulse if durable/logical state changes
4. relationships to connect the facts

No top-level `Signal` export is needed.
