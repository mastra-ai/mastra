---
'@mastra/temporal': minor
---

Improved Temporal worker setup so `MastraPlugin` compiles the Mastra entry file automatically when the worker is configured.

Before:

```ts
const plugin = new MastraPlugin();
await plugin.prebuild({ entryFile: import.meta.resolve('./mastra/index.ts') });
```

After:

```ts
const plugin = new MastraPlugin(import.meta.resolve('./mastra/index.ts'));
```
