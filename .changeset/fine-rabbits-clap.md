---
'@mastra/core': minor
---

Added an optional `title` field to `createTool()`. The title is a human-readable display label that is snapshotted onto `tool-call` and `tool-result` stream chunks and persisted `tool-invocation` message parts, so UIs can show a friendly name instead of the tool id. Falls back to `mcp.annotations.title` when not set. Closes #20757
