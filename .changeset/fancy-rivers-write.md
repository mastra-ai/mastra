---
'@mastra/ai-sdk': minor
---

Added `onError` callback to `handleChatStream()` options. This lets you intercept and sanitize stream errors before they reach the client — useful for preventing internal infrastructure details from leaking to end users.

```ts
const stream = await handleChatStream({
  mastra,
  agentId: 'myAgent',
  params,
  onError: (error) => 'An unexpected error occurred. Please try again.',
})
```
