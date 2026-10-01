---
'@mastra/server': patch
'@mastra/client-js': patch
---

Fixed Studio hiding processors that only implement `processLLMRequest`, such as `ToolCallFilter`. The processors API now reports an `llmRequest` phase for these processors, so they appear in the Processors page, sidebar, and picker. Studio disables direct execution of this phase because it operates on the provider prompt during an agent call. Direct API requests return a 400 error.

For example, `GET /api/processors` can return:

```json
{
  "tool-call-filter": {
    "id": "tool-call-filter",
    "phases": ["llmRequest"],
    "agentIds": ["my-agent"],
    "configurations": [{ "agentId": "my-agent", "type": "input" }],
    "isWorkflow": false
  }
}
```
