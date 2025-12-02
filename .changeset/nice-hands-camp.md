---
'@mastra/core': patch
---

Adds `processInputStep` method to the Processor interface. Unlike `processInput` which runs once at the start, this runs at each step of the agentic loop (including tool call continuations).

```ts
const processor: Processor = {
  id: 'my-processor',
  processInputStep: async ({ messages, messageList, stepNumber, systemMessages }) => {
    // Transform messages at each step before LLM call
    return messageList;
  },
};
```
