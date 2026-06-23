---
'@mastra/ai-sdk': patch
---

Security: error responses from `chatRoute` and `handleChatStream` no longer leak the agent's system prompt back to the client when an upstream LLM call fails. The default error serializer now strips sensitive payload fields before they reach the response stream.

`chatRoute` also accepts an optional `onError` for callers that want richer diagnostics on a trusted surface:

```ts
chatRoute({
  agent: 'support-agent',
  onError: (error) => JSON.stringify(error), // full payload — only safe on trusted surfaces
});
```
