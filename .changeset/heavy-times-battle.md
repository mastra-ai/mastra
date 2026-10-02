---
'@mastra/core': patch
---

Fixed a leak where an output stream processor that throws let the original, unprocessed chunk through. For example, a redaction processor that crashed would still stream the text it was meant to redact.

Now regular, durable, and evented agents stop before emitting the failing chunk, emit an `error` chunk, and finish with `finishReason: 'error'`. Durable tool-chunk processor failures also fail their workflow step before the tool chunk is published. Previously the processor error was logged and the unprocessed chunk was emitted while the stream finished with `finishReason: 'stop'`. `abort()` in a processor still blocks the chunk as before.

```ts
const result = await agent.stream('Reveal the card number');

for await (const chunk of result.fullStream) {
  if (chunk.type === 'error') {
    console.error(chunk.payload.error); // e.g. "redactor crashed"
  }
}
```
