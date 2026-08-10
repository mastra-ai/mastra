# Source Notes

## Docs

`docs/src/content/en/docs/long-running-agents/signals.mdx`

- Signals interact with an agent through a thread.
- Message APIs are for user-authored input.
- `sendSignal()` is lower-level system context.
- `sendStateSignal()` is for durable state lanes.
- `sendNotificationSignal()` creates notification inbox records.
- default behavior delivers to active runs and wakes idle threads.
- state signals use `id`, `cacheKey`, and `mode: snapshot | delta`.
- unchanged state signals can be skipped.
- notification delivery has ingress and dispatch phases.
- notification summaries can stand in for many pending records.

## Signal Model

`packages/core/src/agent/signals.ts`

- categories: `user`, `state`, `reactive`, `notification`.
- legacy types normalize:
  - `user-message` -> `user`
  - `system-reminder` -> `reactive`
- `CreatedAgentSignal` projects to DB, LLM, and stream data formats.
- DB projection uses `role: 'signal'`.
- LLM projection becomes a user-role message, with XML wrapping for non-plain user messages.
- data projection emits `data-user-message` or `data-signal`.
- state signals cannot be transient.

Pulse implication:

- the signal object is a representation of a possible input, not itself an export fact.
- the DB/LLM/data projections correspond to different read/transport concerns.

## State Signals

`packages/core/src/agent/state-signals.ts`

- `applyStateSignal()` creates a state signal input, checks active state, dedupes by cache key and mode, writes the signal, and updates thread metadata.
- tracking stores current cache key, current mode, version, last signal ids, updated timestamp, and active copies.
- state history can be reconstructed from signal DB messages and thread metadata.

Pulse implication:

- accepted state signal content and tracking mutation are different facts.
- skipped state signals should not introduce content.
- thread metadata update is a `ChangePulse`.

## Delivery Runtime

`packages/core/src/agent/types.ts`

- active behaviors: `deliver`, `persist`, `discard`.
- idle behaviors: `wake`, `persist`, `discard`.
- accepted result actions: `wake`, `deliver`, `persist`, `discard`, `blocked`.

`packages/core/src/agent/thread-stream-runtime.ts`

- same-agent active runs queue pending signals.
- local reserved runs queue pre-run signals.
- idle wake reserves a thread and acquires a lease.
- losing a lease race forwards the signal to the winning run.
- transient persist resolves as discard.
- persist-only can write a signal and broadcast a short persisted-signal stream.

Pulse implication:

- delivery decision is a runtime decision Pulse.
- queue/drain facts are state changes only when needed for reconstruction.
- lease-race loss is a delivery detail that may explain cross-process behavior.

## Message List

`packages/core/src/agent/message-list/message-list.ts`

- `addSignal()` turns a `CreatedAgentSignal` into a DB message and adds it to the message list.
- created/accepted timing can be regenerated when the signal enters the transcript.

Pulse implication:

- transcript entry is the stronger content-introduction boundary than signal object creation.

## Processor Signals

`packages/core/src/processors/send-signal.ts`

- processor `sendSignal()` marks a response boundary, rotates response id when supplied, adds signal to the message list, and writes a stream data part.

`packages/core/src/processors/prefill-error-handler.ts`

- sends a reactive `system-reminder` signal and asks for retry on known prefill error.

`packages/core/src/processors/tool-result-reminder.ts`

- sends a reactive `system-reminder` signal when an instruction path is referenced by tool calls.

Pulse implication:

- processor signals are context injections.
- retry/boundary/rotation can be separate Pulses if readers need them; do not fold them into the signal content Pulse blindly.

## Notifications

`packages/core/src/notifications/dispatcher.ts`

- full notification dispatch creates a notification signal, sends it, then stores `deliveredSignalId`.
- summary dispatch creates a notification-summary signal and stores `summarySignalId`.

`packages/core/src/notifications/signals.ts`

- full notification signal uses `tagName: 'notification'`.
- summary signal uses `tagName: 'notification-summary'`.
- metadata connects signal to notification record ids and summary content.

Pulse implication:

- notification record lifecycle is ChangePulse territory.
- signal content projection should relate to one or many notification records.

## Schedules

`packages/core/src/schedules/worker.ts`

- threaded schedule execution builds a signal and calls `agent.sendSignal()`.

Pulse implication:

- schedule firing can be its own Pulse if schedule behavior is in scope.
- signal mapping then follows ordinary delivery rules.

