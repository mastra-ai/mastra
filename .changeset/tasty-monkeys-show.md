---
'@mastra/core': minor
---

Added `maxTokens` to `Memory` so you can cap remembered history by an estimated token budget. When the total token count exceeds the limit, the oldest memory history messages are automatically trimmed.

```ts
new Memory({
  options: {
    lastMessages: Number.MAX_SAFE_INTEGER,
    maxTokens: 800_000,
  },
})
```
