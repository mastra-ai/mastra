---
'@mastra/client-js': minor
---

Added an optional thinking level to controller session `switchModel` calls.

```ts
// Before
await session.switchModel('openai/gpt-5.5');

// After
await session.switchModel('openai/gpt-5.5', 'high');
```
