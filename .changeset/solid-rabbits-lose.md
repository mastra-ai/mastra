---
'@mastra/core': patch
---

Fixed a bug where message-level `providerOptions` could be lost or attached to the wrong message after a tool-call turn in the conversation history. Anthropic `cacheControl` markers now stay on the message they were set on, enabling the rolling prompt-cache breakpoint pattern for tool-using agents.

```ts
await agent.generate([
  { role: 'user', content: 'What is the weather in NYC?' },
  { role: 'assistant', content: [{ type: 'tool-call' /* ... */ }] },
  { role: 'tool', content: [{ type: 'tool-result' /* ... */ }] },
  {
    role: 'user',
    content: 'How about Tokyo?',
    providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
  },
]);
```

Fixes #15474 (continuation of #13849).
