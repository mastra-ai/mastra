---
'@mastra/server': minor
---

Fixed Responses streams so Mastra-hosted server routes emit tool-call argument, function-call, and function-call-output events instead of dropping tool activity from SSE output.

Streamed and stored fallback output now preserves tool items when an agent stream does not return complete DB messages. Response and conversation tool item IDs now use the provider tool call ID, with tool outputs using the `<toolCallId>:output` form, so clients can correlate streamed argument events with completed output items.

Compatibility note: clients that depended on the previous undocumented message-derived tool item IDs should map `<messageId>:<partIndex>:call` and `<messageId>:<partIndex>:output` to the provider tool call ID and `<toolCallId>:output`.

```jsonl
{ "type": "response.function_call_arguments.done", "item_id": "call_123", "name": "weather", "arguments": "{\"city\":\"Lagos\"}" }
{ "type": "response.output_item.done", "item": { "id": "call_123:output", "type": "function_call_output", "call_id": "call_123" } }
```
