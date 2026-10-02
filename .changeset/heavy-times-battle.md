---
'@mastra/core': patch
---

Fixed a leak where an output stream processor that throws let the original, unprocessed chunk through. For example, a redaction processor that crashed would still stream the text it was meant to redact.

Now the run fails before that chunk is emitted. Previously the error was logged and the stream finished with `finishReason: 'stop'`; now the stream ends with the processor's error. This applies to regular, durable, and evented agents. `abort()` in a processor still blocks the chunk as before.

```ts
const result = await agent.stream('Reveal the card number');

for await (const chunk of result.fullStream) {
  if (chunk.type === 'error') {
    console.error(chunk.payload.error); // e.g. "redactor crashed"
  }
}
```
