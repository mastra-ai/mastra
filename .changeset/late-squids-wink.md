---
'@mastra/core': minor
---

Added `spanId` property to agent and workflow results. This exposes the root span ID alongside the existing `traceId` when tracing is enabled. Available on `agent.stream()`, `agent.generate()`, `agent.streamLegacy()`, `agent.generateLegacy()`, and workflow `start()`/`createRun()` results.

**Usage example:**

```typescript
const stream = await agent.stream('Hello');
await stream.consumeStream();

console.log(stream.traceId); // Trace ID for the execution
console.log(stream.spanId);  // Root span ID for the execution
```
