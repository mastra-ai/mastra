---
'@mastra/code-sdk': minor
---

Added a `thinkingResolution` option to `createMastraCodeAgentController`. Hosts that don't offer modes can turn off per-mode thinking defaults, so every run without a session override uses the global thinking level.

```typescript
const controller = await createMastraCodeAgentController({
  thinkingResolution: { applyModeDefaults: false },
});
```
