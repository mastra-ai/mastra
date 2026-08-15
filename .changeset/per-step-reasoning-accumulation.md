---
'@mastra/core': patch
---

Fixed per-step `reasoningText` and `reasoning` accumulating across steps for multi-step reasoning models.

Each step result read the run-lifetime reasoning buffers, which are only cleared at the run boundary, so every step reported the combined reasoning of all prior steps. For a run with two reasoning steps, `steps[1].reasoningText` came back as step one's reasoning concatenated with step two's, and `steps[1].reasoning` contained both steps' reasoning entries. This corrupted `onStepFinish` callbacks, the `steps` array, and anything driven off per-step reasoning.

Each step now reports only its own reasoning, matching how per-step `text` already worked.

```ts
const result = await agent.stream('...'); // reasoning model, multiple steps

// Before: steps[1].reasoningText included step 0's reasoning too.
// After:  each step's reasoningText and reasoning contain only that step's output.
for (const step of await result.steps) {
  console.log(step.reasoningText);
}
```
