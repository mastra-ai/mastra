---
'@mastra/client-js': minor
---

`KnownAgentControllerEvent` is now derived from `AgentControllerWireEvent` in `@mastra/core` instead of re-describing each reshaped payload by hand. A change to a controller event now reaches the SDK types on its own, rather than waiting for someone to copy it across.

Two things are typed more precisely and may need a handler update:

- `display_state_changed` gives `displayState.currentMessage.createdAt` as `string`. It was `Date | string`, so an `instanceof Date` branch on it is now dead code.
- `WireError` is a type alias rather than an interface, so it can no longer be extended by declaration merging. Its shape is unchanged.
