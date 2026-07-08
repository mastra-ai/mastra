# Agent Signals Fit

## Source Summary

Agent Signals expose these categories:

- `user`
- `state`
- `reactive`
- `notification`

State signals add:

- `mode: 'snapshot' | 'delta'`
- `cacheKey`
- `value`
- `delta`
- version tracking
- active copy tracking

Signal providers add:

- subscription registry
- external resource id
- poll/webhook entry points
- notification delivery into agent threads

## Mapping

| Signal Family | Candidate Export | Notes |
| --- | --- | --- |
| user signal | `Pulse(signal.accepted)` | Starts or joins an agent flow. |
| reactive signal | `Pulse(signal.accepted)` | Includes system reminders and reactive context. |
| notification signal | `Pulse(signal.notification_received)` | Explains why a thread woke up or received external context. |
| state signal snapshot | `Change(context.state_snapshot_applied)` and maybe `Pulse(signal.state_applied)` | Durable state/version change plus runtime observation. |
| state signal delta | `Change(context.state_delta_applied)` and maybe `Pulse(signal.state_applied)` | Delta is operation payload, not separate export type. |
| provider subscribe | `Relationship(thread_subscribed_to_external_resource)` or `Change(signal_subscription.created)` | Not a runtime Pulse unless it triggers agent work. |
| provider unsubscribe | `Change(signal_subscription.removed)` | Same. |
| provider poll/webhook | `Pulse(signal_provider.webhook_received)` only if it results in notification or error | Internal polling noise should be filtered. |

## Shape Concern

State signals are the hardest case because they are both:

- an input-like thing added to the transcript/context
- a durable logical state version

Two-export pattern:

```txt
Change(context.state_delta_applied)
Relationship(flow_uses_change)
Pulse(signal.state_applied)
```

This is verbose, but it prevents stuffing state version metadata and runtime flow review into one bloated object.

Reduced alternative:

```txt
Change(context.state_delta_applied)
Relationship(flow_contains_change)
```

This removes the Pulse but may make flow review miss the moment the state entered execution.

## Current Leaning

Use both only when state signal affects the active model context for a flow.

Use only `Change` when state changes outside an active flow or is persisted as background state.

