---
'@mastra/client-js': minor
---

Fixed the agent controller event types, which described payloads the server never sends.

`KnownAgentControllerEvent` was written by hand and had drifted from the controller. Narrowing on `om_activation` gave you an `enabled` boolean that does not exist, `om_status` a `status` string instead of the token windows, `om_thread_title_updated` a `title` instead of `newTitle`, and `subagent_end` only a `toolCallId` — its `agentType`, `result`, `isError` and `durationMs` were missing. `usage_update` typed its payload as `unknown`, so every consumer cast it. Seven events the controller emits (`state_changed`, `command_exit`, `tool_suspension_cancelled`, and the four remaining `subagent_*` events) were not typed at all and fell through `isKnownAgentControllerEvent`.

The union is now derived from the controller's own event type, with explicit overrides for the four events the wire reshapes (`error`, `workspace_error`, `workspace_status_changed`, `display_state_changed`). Payload drift becomes a compile error instead of a wrong field at runtime.

```ts
// Before: compiled, but `enabled` is always undefined
if (event.type === 'om_activation' && event.enabled) { ... }

// After: tsc rejects it; the event carries cycleId, tokensActivated, generationCount, …
if (event.type === 'om_activation') { console.log(event.tokensActivated) }
```
