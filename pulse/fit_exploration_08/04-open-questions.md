# Open Questions

## Should `modelInputId` Become A First-Class Endpoint?

Current leaning: yes, at least as a derived endpoint id.

Reason:

- `messageId` is close but overloaded with assistant response ids and response rotation.
- exact model input reconstruction needs a stable identity for "the prompt sent to the model now."

Possible endpoint:

```ts
{ kind: 'model_input', id: 'model_input_123' }
```

Risk:

- this could grow into another exported envelope if not constrained.

Constraint:

- `model_input` endpoint ids are derived/index identities like Flow ids, not exported records.

## Is `after_response_boundary` A Relationship Or Attribute?

Current leaning: relationship if replay depends on it.

The source marks response boundaries on assistant messages so later signals are separated from the prior assistant response. If replay can derive this from model input sequence, an attribute may be enough.

## Should Queue State Be Exported If Drain Emits Exact Context Entry?

Yes when delivery and drain are separated.

Drain alone can reconstruct model input. Queue records explain latency, blocking, failed drain, and distributed handoff.

## How Much Distributed Lease Behavior Should Pulse Expose?

Expose only when it affects signal visibility.

Good:

- signal forwarded to winner
- local copy discarded
- drain failed and left signal queued

Skip by default:

- lease renewals
- routine acquire/release noise

## Can Content Order Use Timestamps?

No.

MessageList deliberately rewrites timestamps to preserve insertion order. Pulse should capture the order fact directly through model input id, context sequence, or relationships.

