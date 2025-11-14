---
'@mastra/inngest': patch
'@mastra/core': patch
---

Add timeTravel to workflows. This makes it possible to start a workflow run from a particular step in the workflow

Example code:
```ts
const result = await run.timeTravel({
  step: "step2",
  inputData: {
    value: "input"
  }
})
```
