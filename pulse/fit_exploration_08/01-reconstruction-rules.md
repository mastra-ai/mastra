# Reconstruction Rules

## Rule 1: Delivery Is Not Visibility

`signal.delivery_decided: deliver` records routing success, not model visibility.

It should answer:

- did the runtime accept the signal for routing?
- which run/thread did it target?
- did it wake, deliver, persist, discard, or block?
- was it queued locally, forwarded remotely, or attached to a reservation?

It should not answer:

- which model request saw the signal
- where the signal belongs in the prompt
- whether it forced continuation

## Rule 2: Context Entry Owns Signal Content

The signal content owner is the Pulse emitted when the signal enters the transcript/model context.

Suggested shape:

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'drained_to_context',
  attributes: {
    signalId: 'sig_123',
    scope: 'pending',
    modelInputId: 'model_input_456',
    messageId: 'msg_789',
    forcedContinuation: true
  }
}
```

Use `introduced_content` from this Pulse to the signal content ref.

## Rule 3: Queue Records Explain Latency

Emit `ChangePulse(signal_queue.enqueued)` when delivery and context entry are separated.

Queue attributes:

```ts
{
  signalId: 'sig_123',
  scope: 'pre-run' | 'pending' | 'idle',
  targetRunId?: 'run_123',
  targetThreadId: 'thread_123'
}
```

Queue records are required when the signal is accepted before a model input turn can consume it.

## Rule 4: Drain Records Bind To Model Input

Every delayed signal that becomes model-visible needs a drain/content Pulse with one of:

- `modelInputId`
- `messageId`
- explicit order relationship to the model-input Pulse

Candidate relationships:

- `drained_signal`
- `introduced_content`
- `included_in_model_input`
- `after_response_boundary`

## Rule 5: Pre-Run And Pending Cannot Collapse

`scope: 'pre-run'`:

- signal was queued before first model request
- folded into first model input
- does not itself force a later turn

`scope: 'pending'`:

- signal was queued after run was active/blocking
- drained after an iteration
- marks a response boundary
- rotates message id
- forces continuation / later model turn

Both can use `drained_to_context`; `scope` and attributes distinguish replay behavior.

## Rule 6: Timestamps Alone Are Not Sufficient

MessageList creates ordering timestamps at context-entry time and may preserve original signal accepted/created times in metadata.

Pulse replay should not infer model visibility from original signal `createdAt` or API acceptance time.

Need at least one explicit ordering anchor:

- model input id
- message id
- context sequence
- `next_context_item`
- `included_in_model_input`

