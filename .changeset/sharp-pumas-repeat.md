---
'@mastra/client-js': minor
---

`KnownAgentControllerEvent` is now derived from `AgentControllerWireEvent` in `@mastra/core` instead of re-describing each payload by hand. A change to a controller event reaches the SDK types on its own, rather than waiting for someone to copy it across.

Two things are typed more precisely and may need a handler update:

- `display_state_changed` no longer marks its fields optional. `displayState.activeTools` and friends are always present (empty when there is nothing to show), so an `if (displayState.activeTools)` guard is now dead code.
- The `error` event's `error` is no longer typed as possibly a string. No server ever sent one; it is the serialized error, with `name`, `message` and whatever else the error carried.
