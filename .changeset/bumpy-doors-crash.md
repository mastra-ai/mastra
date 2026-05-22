---
'@mastra/core': patch
---

Fixed tool execution errors being stored as successful results, which caused failed tool calls to reappear as successes when a conversation was reloaded from history. When a tool throws (or a provider-executed tool reports a failure), the result is now persisted as `state: "output-error"` with `errorText` instead of `state: "result"`, so the error survives history reload via `toAISdkV5Messages()` and matches the live streaming behavior. Fixes #15569.
