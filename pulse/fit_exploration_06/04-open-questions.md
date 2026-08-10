# Open Questions

## Should `signal.accepted` Mean Routing Accepted Or Context Accepted?

Recommendation: use `signal.delivery_decided` for routing and reserve `signal.accepted` for content entering context/transcript.

Risk:

- current implementation names the API promise `accepted`, and docs talk about accepted signals. Pulse terminology may diverge from API terminology.

Possible mitigation:

- use `signal.routed` or `signal.delivery_decided` for the API-level accepted decision.
- use `content.introduced` plus surface `signal` for context entry.

## Does A Persisted Signal Need Both Pulse And ChangePulse?

Sometimes.

If persisted signal content should be reconstructed into a later context, emit a content-introducing Pulse. If the important fact is only "thread context changed by adding a signal row," a ChangePulse may be enough.

Open issue:

- Need a stricter rule for persisted signals that are never model-visible versus persisted signals that later become model-visible.

## Should Signal Queue Enqueue/Drain Be Core?

Probably not as a universal rule.

Queue facts matter when explaining why a signal was not visible until the next model input. They do not need to be emitted for every signal if delivery and content-introduction Pulses already reconstruct behavior.

## Are State Signal Snapshots `SnapshotPulse`?

No.

State signal `mode: 'snapshot'` is a domain-level state-signal mode. It should not imply Pulse `SnapshotPulse`.

Use `ChangePulse(signal.state_tracking_updated)` plus signal metadata `mode: 'snapshot'`.

## Should State Signal `value` And `delta` Be Content Or Metadata?

Current leaning:

- `contents` is model-facing content body.
- `value` and `delta` are structured state payloads and may need content refs or attributes depending on size.

Risk:

- putting large `value` payloads in Pulse attributes could recreate repeated message/state arrays.

## Are Notification Records Definitions, Content, Or State?

State.

Notification records are durable inbox state. Notification signals are content projections of that state into the agent context.

## Does `data-signal` Need A Pulse?

Usually no.

`data-signal` is a stream projection of an accepted signal. Emit stream transport Pulses only if debugging subscriber transport or stream replay is in scope.

## Does Signal Delivery Require New Relationships?

Maybe.

Candidate signal-specific relationships are useful for readability, but they may duplicate existing Flow/thread relationships. Promote only relationships that change reader behavior:

- `applies_state_signal` seems useful.
- `notification_signal_for` and `summary_signal_for` seem useful.
- `woke_flow` and `delivered_to_flow` may be derivable from `origin_of`, `flow_contains`, and `thread_contains_flow`.

