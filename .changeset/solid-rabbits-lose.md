---
'@mastra/core': patch
---

Fixed message-level `providerOptions` being dropped or attached to the wrong message when the conversation history contained tool calls. This blocked Anthropic prompt-cache markers (`cacheControl: { type: 'ephemeral' }`) from reaching the API on the right message and prevented the rolling cache-breakpoint pattern for tool-using agents.

The `UIMessage → ModelMessage` conversion mapped messages by array index, but an assistant turn with a tool call splits into `[assistant tool-call, tool tool-result]`, throwing the index alignment off for every message after it. The conversion now walks UI messages individually and attaches metadata to the produced model message of matching role.

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
