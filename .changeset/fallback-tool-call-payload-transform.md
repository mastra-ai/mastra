---
'@mastra/core': patch
---

Fixed tool payload transforms (display/transcript redaction) being skipped on streamed `tool-call` chunks, including the call Mastra builds itself when a provider streams tool input but never sends a final tool call. Consumers of `fullStream` now get the transform metadata on every `tool-call` chunk instead of the raw arguments.
