---
'@mastra/core': minor
---

Changed AgentController sessions to keep one active model instead of a separate model for each mode. Switching modes no longer changes the model automatically, and `session.model.switch` no longer accepts `modeId` or `scope`. The `model_changed` event no longer includes `modeId` or `scope`; consumers should read its `modelId` field only. Existing threads still restore legacy per-mode model metadata, but new model selections persist as `currentModelId`. Use `session.model.set` for an in-memory selection that should not be persisted or emit a model-change event.

**Before**

```ts
await session.model.switch({ modelId: 'openai/gpt-5.6', modeId: 'build' });
await session.mode.switch({ modeId: 'plan' }); // Restored the plan mode model.
```

**After**

```ts
await session.model.switch({ modelId: 'openai/gpt-5.6' });
await session.mode.switch({ modeId: 'plan' }); // Keeps openai/gpt-5.6 active.
```
