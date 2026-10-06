---
'@mastra/core': minor
---

Changed `session.model.switch` to accept a model ID followed by an optional options object. Pass `{ thinkingLevel }` to apply and persist model and thinking level together. Every `model_changed` event includes the current thinking level, even when it is unchanged. Sessions synchronize both preferences from persisted thread settings before the next request, including thinking-only changes and removed overrides. Switches canceled by a thread change before any selection is committed reject without counting model use; writes already committed to the captured thread remain successful.

```ts
// Before
await session.model.switch({ modelId: 'openai/gpt-5.5' });
await session.state.set({ thinkingLevel: 'high' });

// After
await session.model.switch('openai/gpt-5.5', { thinkingLevel: 'high' });
```
