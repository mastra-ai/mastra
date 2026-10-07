---
'@mastra/ai-sdk': patch
---

Restored live sub-agent progress in `handleChatStream()` and `chatRoute()`. Both helpers now stream `data-tool-agent` and `data-tool-agent-step` parts by default when an agent delegates to sub-agents, including on the AI SDK v6/v7 approval-resume path. These parts can contain sub-agent reasoning and intermediate tool calls and results. Pass `includeSubAgentMetadata: false` to turn them off.

```ts
chatRoute({
  path: '/chat/:agentId',
  includeSubAgentMetadata: false,
});
```
