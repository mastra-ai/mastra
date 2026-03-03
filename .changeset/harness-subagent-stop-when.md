---
'@mastra/core': minor
---

Added `maxSteps` and `stopWhen` support to `HarnessSubagent`.

You can now define `maxSteps` and `stopWhen` on a harness subagent so spawned subagents can use custom loop limits instead of relying only on the default `maxSteps: 50` fallback.

```ts
const harness = new Harness({
  id: 'dev-harness',
  modes: [{ id: 'build', default: true, agent: buildAgent }],
  subagents: [
    {
      id: 'explore',
      name: 'Explore',
      description: 'Inspect the codebase',
      instructions: 'Investigate and summarize findings.',
      defaultModelId: 'openai/gpt-4o',
      maxSteps: 7,
      stopWhen: ({ steps }) => steps.length >= 3,
    },
  ],
})
```
