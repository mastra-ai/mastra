---
'@mastra/core': patch
---

Fixed per-step `reasoningText` and `reasoning` accumulating across steps for multi-step reasoning models.

In a run with more than one reasoning step, each step reported the combined reasoning of all prior steps. For two reasoning steps, `steps[1].reasoningText` came back as step one's reasoning concatenated with step two's, and `steps[1].reasoning` contained both steps' entries. The same wrong values reached the `onStepFinish` callback.

Each step and its `onStepFinish` payload now report only that step's own reasoning, matching how per-step `text` already worked. The run-level `reasoningText` and `reasoning` on the final result stay cumulative across the whole run.

```ts
const result = await agent.stream('...'); // reasoning model, multiple steps

// Before: steps[1].reasoningText included step 0's reasoning too.
// After:  each step's reasoningText and reasoning contain only that step's output.
for (const step of await result.steps) {
  console.log(step.reasoningText);
}
```
