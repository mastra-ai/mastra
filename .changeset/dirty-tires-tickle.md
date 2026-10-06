---
'@mastra/code-sdk': minor
---

Made the controller runtime independent of Mastra Code model packs. Hosts can now provide a generic modelRoute for fallback models, account routing, and observational-memory models. Removed disableModelPacks and activeModelPackId from the controller runtime state.

**Before**

```ts
const code = await createMastraCode({ disableModelPacks: true });
await session.state.set({ activeModelPackId: 'anthropic' });
```

**After**

```ts
const code = await createMastraCode();
await session.state.set({
  modelRoute: {
    entries: [
      { id: 'primary', label: 'Primary', modelId: 'openai/gpt-5.6' },
      { id: 'fallback', label: 'Fallback', modelId: 'anthropic/claude-fable-5' },
    ],
  },
});
```
