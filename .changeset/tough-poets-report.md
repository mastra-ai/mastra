---
'@mastra/factory': minor
---

Added step states to the workflow board engine. A card's `factory-board` run now records what the card is doing (`resting`, `awaiting_start`, `running`, `probing`, `awaiting_approval`, `needs_attention`, `terminal`), with its phase, how many runs ended there without an outcome, and the last outcome. Read it with the engine's new optional `describe`:

```ts
const engine = createWorkflowBoardEngine(context);
const doing = await engine.describe({ workItemId });
// { state: 'probing', phase: 'execute', probes: 1 }
```

A run that ends without an outcome is run once more, and after a second such end the card needs attention, with a reason. A session waiting on a person (a submitted plan, a held tool call) leaves its card awaiting approval; custom engines can hear of it through the new optional `runPaused(binding, 'approval')`. The default engine behaves as before.
