---
'@mastra/core': patch
---

Fixed durable agents stopping when an output processor asks for a retry. `abort(reason, { retry: true })` in `processOutputStep` now calls the model again with the reason as feedback, up to `maxProcessorRetries` (set on the agent or per call), like regular agents do.

Fixed durable agent streams ending early when an output processor blocks a response. The stream now ends with a `finish` chunk, `finishReason` is `'tripwire'`, `onFinish` is called, and `output.tripwire` holds the reason. Durable streams no longer emit a separate `tripwire` chunk for this case, matching regular agents. See #22980.

**Migrating from the `tripwire` chunk**

If you listened for the `tripwire` chunk on a durable stream, read `finishReason` and `output.tripwire` instead:

```ts
// Before
for await (const chunk of output.fullStream) {
  if (chunk.type === 'tripwire') console.log(chunk.payload.reason);
}

// After
for await (const chunk of output.fullStream) {
  // render chunks as usual
}
if ((await output.finishReason) === 'tripwire') {
  console.log(output.tripwire?.reason);
}
```
