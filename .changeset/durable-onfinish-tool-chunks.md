---
'@mastra/core': patch
---

Fixed `onFinish` and `onAbort` callbacks on durable and evented agents returning raw tool payloads. `toolResults`, `toolCalls`, and each `steps[].toolResults` / `steps[].toolCalls` are now `tool-result` / `tool-call` chunks, matching the default agent, so the same callback code works on every engine.

```ts
onFinish: ({ toolResults }) => {
  for (const chunk of toolResults) {
    console.log(chunk.payload.toolName, chunk.payload.result);
  }
};
```
