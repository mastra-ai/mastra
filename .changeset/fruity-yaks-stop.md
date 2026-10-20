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

Durable transports reconstruct the error from its serialized name and message. The original stack, cause, and subclass identity do not survive a cross-process boundary. Core durable and evented workflows classify this failure with the reserved internal `DURABLE_AGENT_STOP_WHEN_FAILED` identifier. Inngest's serve transport uses the memoized step's `stop-when-` id prefix because its `StepError` serialization does not retain that identifier or its details. Any failure inside that Inngest step is therefore classified as a `stopWhen` failure.
