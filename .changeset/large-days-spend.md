---
'@mastra/core': minor
---

Added `optionalDynamicMemory()` in `@mastra/core/agent`. Wrap a dynamic memory resolver with it when an empty result should mean the agent runs without memory for that call, instead of throwing. Plain memory functions still throw when they return nothing.

```ts
const agent = new Agent({
  // ...
  memory: optionalDynamicMemory(({ mastra }) => mastra?.listMemory()['supportMemory']),
});
```
