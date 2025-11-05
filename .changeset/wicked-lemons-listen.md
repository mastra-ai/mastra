---
'@mastra/core': patch
---

Fix message conversion for incomplete client-side tool calls

Fixed handling of `input-available` tool state in `sanitizeV5UIMessages()` to differentiate between two use cases:

1. **Response messages FROM the LLM**: Keep `input-available` states (tool calls waiting for client-side execution) in `response.messages` for proper message history.

2. **Prompt messages TO the LLM**: Filter out `input-available` states when sending historical messages back to the LLM, as these incomplete tool calls (without results) cause errors in the OpenAI Responses API.

The fix adds a `filterIncompleteToolCalls` parameter to control this behavior based on whether messages are being sent to or received from the LLM.
