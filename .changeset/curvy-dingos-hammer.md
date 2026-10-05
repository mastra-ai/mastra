---
'mastracode': minor
---

Moved model-pack ownership into the Mastra Code TUI. The TUI now reapplies the active pack model when modes change and translates pack fallbacks into generic controller model routes. Per-thread, per-mode model overrides have been removed; mode-specific choices belong to the pack.

**Before**

```ts
await session.thread.setSetting({ key: 'modeModelId_build', value: 'openai/gpt-5.6' });
await session.mode.switch({ modeId: 'build' });
```

**After**

```ts
await switchModeWithPack(context, 'build');
// The TUI resolves the active pack and persists one currentModelId.
```
