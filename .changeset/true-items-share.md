---
'@mastra/mcp': minor
---

Added answering MCP task input from the agent chat. When a tool call that continues as an MCP task needs input, and no `inputRequests` handler is configured, the call now suspends with the server's requests instead of failing with `MCP_CLIENT_TOOL_TASK_INPUT_UNHANDLED`. The remote task stays open. Resuming the call answers that same task, and the tool is never called a second time.

```typescript
// The tool call suspended with { type: 'mcp-input-request', taskId, requests: { approve: { ... } } }
await agent.resumeStream(
  { inputResponses: { approve: { action: 'accept', content: { ok: true } } } },
  { runId, toolCallId },
);
```

If the server asks again, the call suspends again. A configured `inputRequests` handler still answers first, and a direct `tool.execute()` call without an agent or workflow still fails as before. See [#28986](https://github.com/mastra-ai/mastra/issues/28986).
