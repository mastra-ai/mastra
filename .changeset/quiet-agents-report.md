---
'@mastra/ai-sdk': patch
---

`handleChatStream()` and `chatRoute()` can now stream live sub-agent progress to your UI as `data-tool-agent` parts. Pass `includeSubAgentMetadata: true` to turn it on.

It is opt-in and defaults to `false`.

The parts can include the sub-agent's reasoning and intermediate tool data, so only enable it for clients allowed to see them.

```ts
chatRoute({ path: '/chat/:agentId', includeSubAgentMetadata: true });

handleChatStream({ mastra, agentId, params, includeSubAgentMetadata: true });
```
