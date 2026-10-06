---
'@mastra/core': minor
---

Added an optional `thinkingLevel` to `session.model.switch` so model and reasoning effort are applied and persisted together. The `model_changed` event includes the supplied level.

```ts
// Before
await session.model.switch({ modelId: 'openai/gpt-5.5' });
await session.state.set({ thinkingLevel: 'high' });

// After
await session.model.switch({ modelId: 'openai/gpt-5.5', thinkingLevel: 'high' });
```
