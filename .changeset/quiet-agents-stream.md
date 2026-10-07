---
'@mastra/ai-sdk': patch
---

Restored live sub-agent progress in `handleChatStream()` and `chatRoute()`. Agents that delegate to sub-agents once again stream `data-tool-agent` and `data-tool-agent-step` parts, including on the AI SDK v6/v7 approval-resume path. Pass `includeSubAgentMetadata: false` to turn them off.

```ts
chatRoute({
  path: '/chat/:agentId',
  includeSubAgentMetadata: false,
});
```

Fixes #25955.
