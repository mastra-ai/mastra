---
'@mastra/core': patch
---

Durable agents now retry Gemini `MALFORMED_FUNCTION_CALL` responses through the default error processors, the same way regular agents do. Before, a stream that ended with `finishReason: 'error'` but no error payload was not treated as an error, so the turn ended empty with no retry and no error. Durable agents now raise it as an `AGENT_STREAM_ERROR` with `details.rawFinishReason`.
