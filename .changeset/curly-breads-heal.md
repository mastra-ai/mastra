---
'@mastra/observability': minor
---

Changed `MODEL_CHUNK` `tool-result` span `output` handling.

**What changed**

- `MODEL_CHUNK` spans for `tool-result` now omit `output` for locally executed tools.
- `TOOL_CALL` remains the canonical span for locally executed tool result payloads.
- `MODEL_CHUNK` spans for provider-executed `tool-result` chunks still include `output`.
- `MODEL_CHUNK` metadata still includes `toolCallId`, `toolName`, and `providerExecuted`.

**Why**
This reduces duplicate tool result payloads in traces without dropping provider-emitted tool results that may not have a matching `TOOL_CALL` span.
