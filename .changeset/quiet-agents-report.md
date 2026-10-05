---
'@mastra/ai-sdk': patch
---

Fixed `handleChatStream()` and `chatRoute()` not letting you stream `data-tool-agent` parts for sub-agents, which left UIs that render live sub-agent progress with only the final tool output. Both now accept `includeSubAgentMetadata` and forward it to every stream conversion, including the v6/v7 approval-resume path. It defaults to `false` (opt-in, same as `toAISdkStream()`) because these parts can include the sub-agent's reasoning and intermediate tool inputs and results, so only enable it for clients allowed to see them.

```ts
chatRoute({ path: '/chat/:agentId', includeSubAgentMetadata: true });

handleChatStream({ mastra, agentId, params, includeSubAgentMetadata: true });
```
