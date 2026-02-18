---
'@mastra/core': patch
---

Fixed tool execution errors being emitted as `tool-result` instead of `tool-error` in fullStream. Previously, when a tool's execute function threw an error, the error was caught and returned as a value, causing the stream to emit a `tool-result` chunk containing the error object. Now errors are properly propagated, so the stream emits `tool-error` chunks, allowing consumers (including the `@mastra/ai-sdk` conversion pipeline) to correctly distinguish between successful tool results and failed tool executions. Fixes #13123.
