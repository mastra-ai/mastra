---
'@mastra/core': patch
---

Fixed custom `stopWhen` conditions on durable and evented agents receiving tool results in Mastra's internal shape. Each step's `toolResults` now uses the same AI SDK tool-result parts as the default agent (`type: 'tool-result'`, `input`, `output`), so a condition that reads `toolResults[i].output` stops the run when it should. Fixes [#28519](https://github.com/mastra-ai/mastra/issues/28519).

If your condition read the old internal fields, switch to the AI SDK fields:

```ts
// Before: only matched on these agents
stopWhen: ({ steps }) => steps.at(-1)?.toolResults.some(r => r.result?.conditions === 'sunny'),

// After: matches on every agent type
stopWhen: ({ steps }) => steps.at(-1)?.toolResults.some(r => r.output?.value?.conditions === 'sunny'),
```

Use `input` instead of `args` in the same way.
