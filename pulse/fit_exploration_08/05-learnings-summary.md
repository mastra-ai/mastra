# Learnings Summary

## Main Result

The key unit for reconstruction is not signal delivery. It is model visibility.

Pulse needs an explicit fact for when a delayed signal enters transcript/model context.

Recommended required facts for delayed signals:

1. `signal.delivery_decided`
2. `signal_queue.enqueued`
3. `signal.drained_to_context`
4. `introduced_content`
5. `included_in_model_input` or equivalent model-input ordering anchor

## Why Delivery Alone Fails

`deliver` can mean several different things:

- queued into an active run
- queued before a reserved run's first request
- forwarded to another process that won a lease
- attached to a continuation reservation

Only one of those says anything about model visibility, and even then it does not identify the model input turn.

## Stronger Rule

For delayed Agent Signals:

- delivery Pulse owns routing
- queue ChangePulse owns delayed state
- drain/content Pulse owns signal body
- model input relationship owns visibility/order

## Pre-Run Versus Pending

Pre-run and pending are not cosmetic scopes.

- pre-run signals are part of the first model request
- pending signals are part of a later model request and force continuation

This distinction is required for replay.

## MessageList Implication

MessageList rewrites signal timestamps when a signal is added to context and stores original signal timing in metadata.

Pulse should not use original signal creation/acceptance time to infer prompt order.

## Candidate Relationships

High-confidence:

- `queued_signal`
- `drained_signal`
- `included_in_model_input`
- `introduced_content`

Candidate:

- `after_response_boundary`
- `signal_forwarded_to_owner`
- `local_signal_copy_discarded`

## Current Model Impact

The export family remains:

```ts
type PulseExport =
  | Pulse
  | Relationship;
```

But the relationship vocabulary should likely add `included_in_model_input`, and the read-model set should include model input identity/order.

