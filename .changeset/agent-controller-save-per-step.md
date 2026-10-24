---
'@mastra/core': patch
---

Added a `savePerStep` option to `AgentController`. Set it to `true` to save messages after each finished step, so a run that stops mid-way keeps its earlier steps. It defaults to `false`, so existing controllers still save once when the run ends.

```ts
const controller = new AgentController({
  id: 'my-controller',
  modes,
  savePerStep: true,
});
```
