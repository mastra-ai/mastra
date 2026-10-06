---
'@mastra/core': minor
---

Changed `session.model.switch` to accept a model ID followed by an optional options object. Pass `{ thinkingLevel }` to apply and persist model and thinking level together. Every `model_changed` event includes the current thinking level, even when it is unchanged. Sessions synchronize both preferences from persisted thread settings before the next request, including thinking-only changes and removed overrides.

```ts
// Before
await session.model.switch({ modelId: 'openai/gpt-5.5' });
await session.state.set({ thinkingLevel: 'high' });

// After
await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
```
