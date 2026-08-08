---
'@mastra/core': minor
---

Added the `bundler.entries` config option, a map of output name to source path for extra process entries that `mastra build` should emit alongside the server bundle.

```typescript title="src/mastra/index.ts"
export const mastra = new Mastra({
  bundler: {
    entries: { 'voice-worker': './voice-worker.ts' },
  },
})
```

This emits `.mastra/output/voice-worker.mjs` next to `.mastra/output/index.mjs`. Entry names cannot be `index`, `tools`, or start with `tools/`. See the `@mastra/deployer` changelog for details.
