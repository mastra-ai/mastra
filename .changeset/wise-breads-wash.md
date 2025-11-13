---
'@mastra/core': patch
---

Add `initialState` and `outputOptions` to run.stream() call.

Example code
```
const run = await workflow.createRunAsync();

const streamResult = run.stream({
  inputData: {},
  initialState: { value: 'test-state', otherValue: 'test-other-state' },
  outputOptions: { includeState: true },
});
```
Then the result from the stream will include the final state information

```
const executionResult = await streamResult.result;
console.log(executionResult.state)
```