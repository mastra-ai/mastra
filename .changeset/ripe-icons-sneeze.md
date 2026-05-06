---
'@mastra/server': minor
---

Fixed Responses streams so Mastra-hosted server routes emit tool-call argument, function-call, and function-call-output events instead of dropping tool activity from SSE output.

Streamed and stored fallback output now preserves tool items when an agent stream does not return complete DB messages. Response and conversation tool item IDs now use provider tool call IDs, with tool outputs using the `<toolCallId>:output` form, so clients can correlate streamed arguments with completed tool outputs.
