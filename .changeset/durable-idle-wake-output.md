---
'@mastra/core': patch
---

Fixed `sendSignal(..., { ifIdle: { behavior: 'wake' } })` on a DurableAgent so `accepted.output` is a `MastraModelOutput`, matching its type and the regular Agent. Previously it returned the durable stream wrapper, so `await accepted.output.text` was `undefined`.

```ts
const { accepted } = durableAgent.sendSignal(signal, { resourceId, threadId, ifIdle: { behavior: 'wake' } });
const result = await accepted;
await result.output?.text; // now the generated text
```
