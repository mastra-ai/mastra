---
'@mastra/core': patch
---

Fixed `isTaskComplete` completion checks leaking the internal scorer report (`#### Completion Check Results`) into the agent's final answer and saved conversation history.

When completion scorers passed on the first check, the report was appended after the model's answer and became the last response message. Agents with memory (or any output processors) then resolved `stream.text` and the persisted assistant message to the report instead of the real answer.

```ts
const stream = await agent.stream('What is the capital of France?', {
  memory: { thread, resource },
  isTaskComplete: { scorers: [myScorer] },
});

// Before: '#### Completion Check Results ...'
// After:  'The capital of France is Paris.'
console.log(await stream.text);
```

Scorer feedback is now only added to the conversation when a check fails, where it steers the next iteration. Failing checks still retry with feedback exactly as before. Fixes [#19875](https://github.com/mastra-ai/mastra/issues/19875).
