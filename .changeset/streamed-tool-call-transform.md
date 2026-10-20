---
'@mastra/core': patch
---

Fixed tool payload transforms not being applied to streamed tool calls. When a model streamed tool-call arguments, the `tool-call` chunk sent to the stream had no transform metadata, so UIs showed the raw arguments instead of the redacted display version. The stream now emits the model's final tool call, which carries the transform.

A tool call ID of `__proto__` no longer breaks the stream.

A later step that reuses a tool call ID is now kept as its own call in `toolCalls` instead of being dropped.
