---
'@mastra/core': minor
'@mastra/memory': minor
---

Added `observationalMemory.toolCallFilter` so Observational Memory can drop raw tool-call arguments and results from message history while keeping the rest of the conversation. Omit the option to keep the current behavior.

```ts
const memory = new Memory({
  options: {
    observationalMemory: {
      toolCallFilter: {
        exclude: ['search'],
        preserveModelOutput: true,
        maxModelOutputBytes: 4096,
      },
    },
  },
});
```
