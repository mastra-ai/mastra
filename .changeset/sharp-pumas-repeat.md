---
'@mastra/client-js': minor
---

`KnownAgentControllerEvent` is now derived from `AgentControllerWireEvent` in `@mastra/core` instead of re-describing each payload by hand. A change to a controller event reaches the SDK types on its own, rather than waiting for someone to copy it across.

Two things are typed more precisely and may need a handler update:

- `display_state_changed` no longer marks its fields optional. `displayState.activeTools` and friends are always present (empty when there is nothing to show), so an `if (displayState.activeTools)` guard is now dead code.
- `WireError` is a type alias rather than an interface, so it can no longer be extended by declaration merging. It is now Mastra's `SerializedError`, so alongside `name` and `message` it allows an optional `cause`; the controller omits stack traces.
