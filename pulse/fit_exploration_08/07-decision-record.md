# Decision Record

## Decision 1: Add Model Visibility Boundary

For delayed Agent Signals, emit a Pulse when the signal becomes model-visible.

Recommended action:

- `signal.drained_to_context`

Acceptable generic alternative:

- `content.introduced` with `surface: signal` and `attributes.source: 'signal_drain'`

The Pulse must identify the signal id and the model input/order anchor.

## Decision 2: Delivery Pulse Does Not Own Delayed Content

For delayed signals, the delivery decision Pulse should not own the content body.

The drain/content Pulse owns it because that is when MessageList assigns transcript order.

## Decision 3: Export Queue State When Delayed

When delivery and model visibility are separated, emit a queue ChangePulse.

Required scopes:

- `pre-run`
- `pending`
- `idle` if pending idle handoff is exported

## Decision 4: Add Model Input Endpoint

Introduce a derived/index endpoint kind:

```ts
{ kind: 'model_input', id: 'model_input_123' }
```

Constraint:

- this is not a new export envelope.
- it has no lifecycle fields or payload.
- it is a relationship endpoint used for reconstruction.

## Decision 5: Required Relationships

Promote these relationship candidates:

- `queued_signal`
- `drained_signal`
- `included_in_model_input`

Keep these as candidates:

- `after_response_boundary`
- `signal_forwarded_to_owner`
- `local_signal_copy_discarded`

## Decision 6: Do Not Trust Original Signal Timestamps

Original signal `createdAt` and accepted time are useful metadata, but they do not determine model input order.

Use context-entry order, model input id, sequence metadata, or explicit relationships.

