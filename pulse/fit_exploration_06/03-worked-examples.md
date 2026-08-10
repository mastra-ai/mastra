# Worked Examples

## 1. Reactive Processor Reminder

Source shape:

- `PrefillErrorHandler.processAPIError()` calls processor `sendSignal()`.
- `sendSignal()` creates a reactive signal, marks a response boundary, adds it to the message list, optionally rotates response message id, and writes a `data-signal` stream part.
- processor returns `{ retry: true }`.

Pulse mapping:

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'accepted',
  text: 'Reactive signal added system reminder context.',
  attributes: {
    signalType: 'reactive',
    tagName: 'system-reminder',
    source: 'processor',
    processorId: 'prefill-error-handler',
    transient: false
  }
}
```

Relationships:

- `introduced_content` from signal Pulse to content ref
- `flow_contains` from current Flow to signal Pulse
- optional `caused_retry` from retry decision Pulse to signal Pulse if retry is emitted as its own Pulse

Do not emit:

- separate signal-created Pulse
- separate data-signal stream Pulse unless stream transport is the thing being audited

## 2. Active Thread Follow-Up

Source shape:

- `sendSignal()` targets `resourceId/threadId`.
- same-agent active run exists.
- runtime queues signal in `pendingSignalsByThread`.
- accepted result resolves `{ action: 'deliver', runId }`.

Pulse mapping:

```ts
{
  type: 'decision',
  surface: 'signal',
  action: 'delivery_decided',
  attributes: {
    decision: 'deliver',
    target: 'active_run',
    runId: 'run_123'
  }
}
```

Then, when the queue is drained into model input:

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'accepted',
  attributes: {
    signalType: 'user',
    tagName: 'user',
    source: 'thread_followup'
  }
}
```

Relationships:

- `delivered_to_flow` or existing `flow_contains` to the active Flow
- `introduced_content` to the user content

The delivery decision and content introduction can be two Pulses because they happen at different semantic moments: routing now, model-context entry later.

## 3. Idle Wake

Source shape:

- no active run owns the thread.
- idle behavior defaults to `wake`.
- runtime reserves thread and acquires lease.
- agent stream starts with the signal as input.

Pulse mapping:

```ts
{
  type: 'decision',
  surface: 'signal',
  action: 'delivery_decided',
  attributes: {
    decision: 'wake',
    target: 'idle_thread',
    lease: 'acquired'
  }
}
```

Relationships:

- `woke_flow` from delivery decision Pulse to derived Flow id
- `origin_of` from origin Pulse to Flow id
- `thread_contains_flow` from thread id to Flow id

Content:

- the origin/input Pulse can also be the signal content Pulse if the signal immediately starts the Flow.
- avoid a separate signal-arrival Pulse unless it carries a different fact from origin/input.

## 4. Persist-Only Signal

Source shape:

- idle or active behavior is `persist`.
- signal is not transient.
- runtime writes signal DB message.
- accepted result resolves `{ action: 'persist' }`.

Pulse mapping:

```ts
{
  type: 'decision',
  surface: 'signal',
  action: 'delivery_decided',
  attributes: {
    decision: 'persist',
    wokeRun: false
  }
}
```

```ts
{
  type: 'state',
  surface: 'context',
  action: 'signal_persisted',
  attributes: {
    role: 'signal',
    signalType: 'notification'
  }
}
```

Relationships:

- `persisted_to_thread` from persisted ChangePulse to thread id
- `introduced_content` from persisted signal Pulse or ChangePulse to content ref

Risk:

- Persisted-signal broadcast creates a short stream-like run in the implementation. Pulse should not treat that as a normal agent Flow unless downstream readers need to show the broadcast as execution.

## 5. State Signal Accepted

Source shape:

- `sendStateSignal()` loads thread and memory.
- `applyStateSignal()` creates state signal, checks cache key/mode, writes the signal, and updates thread metadata.
- accepted state signal is routed through `sendSignal()`.

Pulse mapping:

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'accepted',
  attributes: {
    signalType: 'state',
    stateId: 'browser',
    mode: 'snapshot',
    cacheKey: 'browser:https://example.com:3-tabs',
    version: 4
  }
}
```

```ts
{
  type: 'state',
  surface: 'signal',
  action: 'state_tracking_updated',
  attributes: {
    stateId: 'browser',
    mode: 'snapshot',
    version: 4,
    lastSignalId: 'sig_123'
  }
}
```

Relationships:

- `applies_state_signal` from tracking ChangePulse to signal content Pulse
- `updates_state_lane` from tracking ChangePulse to `{ kind: 'state_lane', id: 'browser' }`
- `introduced_content` from signal Pulse to content ref

## 6. State Signal Skipped

Source shape:

- `applyStateSignal()` sees same cache key/mode and active copy.
- returns `{ skipped: true, reason: 'unchanged' }`.
- no signal is added to message list.

Pulse mapping:

```ts
{
  type: 'decision',
  surface: 'signal',
  action: 'state_signal_skipped',
  attributes: {
    reason: 'unchanged',
    stateId: 'browser'
  }
}
```

Do not emit:

- content Pulse
- ChangePulse

## 7. Notification Summary

Source shape:

- dispatcher batches pending notifications.
- creates a `notification-summary` signal.
- low-priority batch may use persist-only behavior.
- notification records get `summarySignalId`.

Pulse mapping:

```ts
{
  type: 'input',
  surface: 'signal',
  action: 'accepted',
  attributes: {
    signalType: 'notification',
    tagName: 'notification-summary',
    pending: 10
  }
}
```

```ts
{
  type: 'state',
  surface: 'notification',
  action: 'summary_emitted',
  attributes: {
    pending: 10,
    summarySignalId: 'sig_summary_123'
  }
}
```

Relationships:

- `summary_signal_for` from summary signal Pulse to each notification record id
- `applies_state_change` or generic relation from notification ChangePulse to summary signal Pulse

