---
'@mastra/core': patch
---

Fixed `processAPIError` never running for processors registered as `inputProcessors` or `outputProcessors` on an agent. Agents wrap those lists in a processor workflow, and the API-error pass skipped workflows, so only `errorProcessors` could recover from a failed model call. The hook now reaches processors in every lane, on both regular and durable agents, and a processor registered in more than one lane runs once per failure.

```ts
const agent = new Agent({
  // ...
  inputProcessors: [new MyProcessor()], // processAPIError now runs here too
});
```
