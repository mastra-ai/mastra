---
'@mastra/core': patch
'@mastra/ai-sdk': patch
---

Expose finalized prompt/tool waterfall data through Harness display state and
the Harness AI SDK snapshot stream. Harness consumers can now read
`promptWaterfall` from `getDisplayState()` and from the `observability` snapshot
domain instead of needing separate telemetry wrappers.

```ts
const state = harness.getDisplayState();
console.log(state.promptWaterfall);

const stream = harnessToUIMessageStream(harness, { include: ['observability'] });
const snapshot = await stream.getReader().read();
console.log(snapshot.value?.data?.domains?.observability?.promptWaterfall);
```
