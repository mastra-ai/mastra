---
'@mastra/core': patch
'@mastra/inngest': patch
---

Fixed durable, evented, and Inngest agent streams to reject when `stopWhen` throws, matching plain agents.

Previously, these stream consumers could handle this failure as an `error` chunk. Catch the `fullStream` rejection instead:

```ts
try {
  for await (const chunk of output.fullStream) {
    // Handle streamed chunks.
  }
} catch (error) {
  // Handle the error thrown by stopWhen.
}
```

Durable transports reconstruct the error from its serialized name and message. The original stack, cause, and subclass identity do not survive a cross-process boundary. Mastra reserves the internal `DURABLE_AGENT_STOP_WHEN_FAILED` identifier for this classification.
