# Exploration Log

## 2026-08-10 - Source Narrowing

Read:

- `pulse/AGENTS.md`
- `pulse/current-model.md`
- `pulse/glossary.md`
- `pulse/experiment-backlog.md`
- `pulse/fit_exploration_procedure.md`
- `packages/core/AGENTS.md`
- `docs/src/content/en/docs/long-running-agents/signals.mdx`

Searches:

- broad `signal` search across `packages/core/src` and `pulse`
- narrowed search for `createSignal`, `CreatedAgentSignal`, `sendSignal`, `sendStateSignal`, `applyStateSignal`, `addSignal`, and `drainPendingSignals`

Observation:

- broad `signal` searches are noisy because they catch `AbortSignal`, stream cancellation signals, test synchronization signals, and prose.
- the useful source cluster is `packages/core/src/agent/signals.ts`, `state-signals.ts`, `thread-stream-runtime.ts`, processor `send-signal.ts`, and notification dispatch.

Assumption:

- Pulse should describe runtime facts that matter for execution/context reconstruction, not every helper function call that happens to include the word signal.

## 2026-08-10 - Signal Shape

Read:

- `packages/core/src/agent/signals.ts`
- `packages/core/src/agent/message-list/message-list.ts`
- `packages/core/src/processors/send-signal.ts`

Findings:

- `AgentSignalCategory` is `user | state | reactive | notification`.
- legacy `user-message` normalizes to `user`.
- legacy `system-reminder` normalizes to `reactive`.
- `createSignal()` validates and normalizes a signal, but does not imply delivery.
- `CreatedAgentSignal` can project to:
  - DB message with `role: 'signal'`
  - LLM user message with XML wrapping
  - transient stream data part, usually `data-signal`
- `MessageList.addSignal()` writes a signal into the transcript and regenerates timing.
- processor `sendSignal()` marks a response boundary, optionally rotates response message id, adds signal to message list, and echoes it to the writer.

Shape pressure:

- signal creation itself is too early to be a Pulse; many created signals may be skipped, discarded, or only used as conversion objects.
- the durable fact is when a signal is accepted into routing, written into context, persisted, or used to mutate state tracking.

## 2026-08-10 - State Signals

Read:

- `packages/core/src/agent/state-signals.ts`
- state signal docs section

Findings:

- state signals carry `id`, `cacheKey`, `mode: snapshot | delta`, contents, optional `value`, optional `delta`.
- `applyStateSignal()` can skip unchanged state before adding a signal.
- accepted state signals update thread metadata under `mastra.stateSignals`.
- tracking includes current cache key, mode, version, last signal id, last snapshot signal id, updated time, and active copies.
- state signals cannot be transient because dedupe and active-state history are rebuilt from persisted history.

Shape pressure:

- accepted state signals are both content entering context and a state-index mutation.
- duplicate skipped state signals are not content introductions.
- the state tracking metadata update is not the same fact as the signal body; it should be a `ChangePulse`.

## 2026-08-10 - Delivery Policy

Read:

- `packages/core/src/agent/types.ts`
- `packages/core/src/agent/thread-stream-runtime.ts`

Findings:

- `sendSignal()` resolves delivery to `wake`, `deliver`, `persist`, `discard`, or `blocked`.
- active behavior supports `deliver | persist | discard`.
- idle behavior supports `wake | persist | discard`.
- active same-agent runs queue pending signals for in-loop drain.
- local reserved runs queue pre-run signals.
- idle wake reserves a thread and may lose a cross-process lease race; losing forwards the signal to the winning run and still resolves as `deliver`.
- persist-only signals can be saved and broadcast as a short persisted-signal stream.
- transient signals are never persisted; a persist request with transient content becomes `discard`.

Shape pressure:

- delivery decision is a meaningful Pulse when it explains whether a signal joined a run, started a run, persisted without running, was blocked, or was discarded.
- queuing and later draining are different facts from the initial decision.
- `wake` creates or joins a Flow through relationships; it should not force a Flow export.

## 2026-08-10 - Notification And Schedule Signals

Read:

- `packages/core/src/notifications/dispatcher.ts`
- `packages/core/src/notifications/signals.ts`
- `packages/core/src/schedules/worker.ts`

Findings:

- notification ingress can create durable notification records before dispatching a signal.
- dispatch emits a full notification signal or a notification-summary signal.
- notification records store delivery status and delivered/summary signal ids.
- schedules build a signal and call `sendSignal()` for threaded runs.

Shape pressure:

- notification record lifecycle is a state/change concern, not the same thing as the notification signal content.
- delivery signal content should relate back to notification records.
- schedules are a producer of signals, not a distinct Pulse primitive unless schedule firing itself is in scope.

