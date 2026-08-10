# Shape Fit Rules

## Candidate Export Family

```ts
type PulseExport =
  | Pulse
  | Relationship;

type Pulse =
  | ObservationPulse
  | ChangePulse
  | SnapshotPulse;
```

No new top-level `Signal` export is allowed in this exploration.

## Signal Rule

An Agent Signal is not itself a top-level Pulse export shape.

Represent it through:

- content-introducing Pulses when the signal body enters execution context
- decision Pulses when routing/delivery policy is resolved
- ChangePulses when state, notification, queue, or transcript state changes
- Relationships when a signal Pulse relates to a run, flow, thread, notification record, state lane, or previous content

## Creation Rule

`createSignal()` is not enough to emit a Pulse.

Reason:

- it normalizes and validates
- it can be used as a conversion object
- the signal may later be discarded, skipped, persisted, or delivered

Emit only when the signal has a runtime consequence.

## Content Rule

When a signal becomes model-visible or transcript-visible content, emit an `ObservationPulse`:

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'accepted',
  attributes: {
    signalType: 'reactive',
    tagName: 'system-reminder',
    transient: false
  }
}
```

The Pulse owns the signal content item. Large signal bodies may be referenced, but the introducing Pulse remains the conceptual owner.

## Delivery Decision Rule

When `sendSignal()` resolves delivery policy, emit a decision Pulse if the decision affects execution or reconstruction:

- `wake`
- `deliver`
- `persist`
- `discard`
- `blocked`

Suggested shape:

```ts
{
  type: 'decision',
  surface: 'signal',
  action: 'delivery_decided',
  attributes: {
    decision: 'wake',
    activeBehavior: 'deliver',
    idleBehavior: 'wake'
  }
}
```

Do not also emit a duplicate arrival Pulse unless the signal body entered context.

## State Signal Rule

Accepted state signals have two facts:

1. state signal content entered context
2. thread-scoped state-signal tracking changed

Represent these as:

- `ObservationPulse(signal.accepted)` for the content item
- `ChangePulse(signal_state.updated)` for thread metadata/tracking changes
- `Relationship(applies_state_signal)` from the ChangePulse to the content Pulse

Skipped unchanged state signals are `decision` or `state` Pulses only if the skip is useful to debug or audit. They are not content-introducing Pulses.

## Notification Rule

Notification inbox records are durable state. Notification signals are context content.

Represent:

- inbox create/update/status as `ChangePulse(notification_record.*)`
- full notification or summary delivered to context as `ObservationPulse(signal.accepted)`
- relationship from notification signal Pulse to notification record ids

## Queue And Drain Rule

Pre-run and pending signal queues are execution state.

Represent:

- enqueue as `ChangePulse(signal_queue.enqueued)` when reconstruction needs it
- drain as `ChangePulse(signal_queue.drained)` or `ObservationPulse(signal.drained)` only when it changes the next model input
- content introduction remains the signal accepted/content Pulse

## Relationship Rule

Candidate relationships:

| Relationship | Purpose |
| --- | --- |
| `introduced_content` | signal Pulse introduced the signal body |
| `signal_targeted_thread` | signal delivery was addressed to a thread |
| `signal_targeted_run` | signal delivery was addressed to or joined a run |
| `woke_flow` | delivery decision started a new Flow |
| `delivered_to_flow` | signal joined an existing Flow |
| `persisted_to_thread` | signal persisted without waking a run |
| `applies_state_signal` | state tracking ChangePulse applies a state signal Pulse |
| `updates_state_lane` | state tracking ChangePulse updates a state lane id |
| `notification_signal_for` | notification signal Pulse represents notification record id |
| `summary_signal_for` | summary signal Pulse covers notification record ids |

Devil's advocate:

- `signal_targeted_thread`, `signal_targeted_run`, `woke_flow`, and `delivered_to_flow` may be too specific. They should be promoted only if reader behavior differs from existing `thread_contains_flow`, `flow_contains`, `origin_of`, or generic relationships with attributes.
- Avoid turning signal routing internals into an event bus. Pulse only needs facts required to reconstruct context, explain run wake/delivery, or audit state mutation.

