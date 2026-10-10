---
'@mastra/core': patch
---

Fixed `sendSignal(..., { ifIdle: { behavior: 'wake' } })` on a DurableAgent so the accepted result's `output.text` now resolves to the generated text, the same as with a regular Agent. Previously it resolved to `undefined`.

```ts
const { accepted } = durableAgent.sendSignal(signal, { resourceId, threadId, ifIdle: { behavior: 'wake' } });
const result = await accepted;
await result.output?.text; // now the generated text
```
