---
'@mastra/core': major
'@mastra/server': major
'@mastra/client-js': major
'@mastra/agent-builder': major
'@mastra/inngest': major
'@mastra/temporal': major
---

Removed `generateLegacy()`, `streamLegacy()` and the legacy default-option methods. Use `generate()` and `stream()` instead. Model settings now go under `modelSettings`.

```ts
// Before
await agent.generateLegacy('Hello', { temperature: 0.7 });
// After
await agent.generate('Hello', { modelSettings: { temperature: 0.7 } });
```

The `/generate-legacy`, `/stream-legacy` agent routes and the legacy workflow and agent-builder stream routes are removed. `run.streamLegacy()` is removed from workflows; use `run.stream()`.
