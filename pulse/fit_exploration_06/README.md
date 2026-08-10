# Agent Signals Fit Exploration

This exploration tests how Agent Signals should map into the current Pulse model.

It follows the current candidate from `pulse/current-model.md`:

```ts
type PulseExport =
  | Pulse
  | Relationship;

type Pulse =
  | ObservationPulse
  | ChangePulse
  | SnapshotPulse;
```

## Boundary

In scope:

- `sendSignal()` delivery decisions for active and idle threads
- `sendMessage()` / `queueMessage()` as user-signal wrappers
- processor-generated reactive signals
- state signals with snapshot/delta/cache-key tracking
- notification signals and notification-summary signals
- durable signal drains and pre-run / pending queues
- persisted signal rows as content entering context

Out of scope:

- generic `AbortSignal` behavior
- UI-only signal display events
- full notification inbox storage design beyond signal emission
- server/client route schema design
- implementation changes

## Inputs

Read:

- `pulse/AGENTS.md`
- `pulse/current-model.md`
- `pulse/glossary.md`
- `pulse/experiment-backlog.md`
- `pulse/fit_exploration_procedure.md`
- `docs/src/content/en/docs/long-running-agents/signals.mdx`
- `packages/core/AGENTS.md`
- `packages/core/src/agent/signals.ts`
- `packages/core/src/agent/state-signals.ts`
- `packages/core/src/agent/types.ts`
- `packages/core/src/agent/thread-stream-runtime.ts`
- `packages/core/src/agent/message-list/message-list.ts`
- `packages/core/src/processors/send-signal.ts`
- `packages/core/src/processors/prefill-error-handler.ts`
- `packages/core/src/processors/tool-result-reminder.ts`
- `packages/core/src/notifications/dispatcher.ts`
- `packages/core/src/notifications/signals.ts`
- `packages/core/src/schedules/worker.ts`

## Primary Question

How do Agent Signals map without duplicating the same fact as both a Pulse and a ChangePulse?

Candidate answer tested here:

- signal creation is not automatically a Pulse
- accepted signal content is a content-introducing `ObservationPulse`
- delivery policy resolution is a `signal.delivery_decided` `ObservationPulse` when it changes routing or execution
- state signal tracking updates are `ChangePulse` records
- skipped duplicate state signals are decision/skip Pulses, not content Pulses
- notification inbox status changes are `ChangePulse` records that relate to later notification signal Pulses

