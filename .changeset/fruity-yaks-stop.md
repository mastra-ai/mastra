---
'@mastra/core': patch
---

Fixed durable and evented agent streams to reject when `stopWhen` throws, matching plain agents.

Previously, durable and evented stream consumers could handle this failure as an `error` chunk. Catch the `fullStream` rejection instead:

```ts
try {
  for await (const chunk of output.fullStream) {
    // Handle streamed chunks.
  }
} catch (error) {
  // Handle the error thrown by stopWhen.
}
```
