---
'@mastra/core': patch
---

Fixed a leak where an output stream processor that throws let the original, unprocessed chunk through. For example, a redaction processor that crashed would still stream the text it was meant to redact.

Now streamed content chunks processed inside regular, durable, and evented runs stop before the failing chunk is emitted, emit an `error` chunk, and finish with `finishReason: 'error'`. Durable tool-chunk processor failures also fail their workflow step before the tool chunk is published. For durable and evented agents, failures on lifecycle chunks such as `start`, `step-start`, `step-finish`, and `finish` error `fullStream` and reject derived output promises. For regular agents, `step-start` and `finish` failures emit an `error` chunk and resolve with `finishReason: 'error'`, while a `step-finish` failure errors the stream; `start` is not passed to output stream processors. Previously the processor error was logged and the unprocessed chunk was emitted while the stream finished with `finishReason: 'stop'`. `abort()` in a processor still blocks the chunk as before.

```ts
const result = await agent.stream('Reveal the card number');

try {
  for await (const chunk of result.fullStream) {
    if (chunk.type === 'error') {
      console.error(chunk.payload.error); // e.g. "redactor crashed"
    }
  }
} catch (error) {
  // Some lifecycle-chunk processor failures error the stream directly.
  console.error(error);
}
```
