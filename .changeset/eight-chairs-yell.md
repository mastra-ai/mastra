---
'@mastra/server': patch
---

Fixed two things the agent controller's HTTP routes got wrong.

Threads listed through `GET /agent-controller/:id/sessions/:resourceId/threads` leaked internal session bookkeeping as scoping tags: a session's persisted `thinkingLevel` and `notifications` preferences showed up next to real tags like `projectPath`, and could be passed to the `tags` filter. They are now filtered out like the other reserved keys.

Workspace failures streamed over SSE arrived empty. `workspace_error` and `workspace_status_changed` carry an `Error`, whose `name` and `message` are non-enumerable, so JSON serialization sent `"error": {}` and browser clients could not show why the workspace failed. Only the generic `error` event was being flattened; every event that carries an `Error` now is.

The session-state route also returns a typed `tokenUsage` object instead of an opaque record, so clients get the same shape the `display_state_changed` event carries.
