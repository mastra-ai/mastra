---
'@mastra/core': minor
---

Added `spanId` property to agent and workflow results. When using the Braintrust exporter, this corresponds to the Braintrust root span ID, enabling efficient queries against the Braintrust API. Available on `agent.stream()`, `agent.generate()`, `agent.streamLegacy()`, `agent.generateLegacy()`, and workflow `start()`/`createRun()` results.

**Usage example:**

```typescript
const stream = await agent.stream('Hello');
await stream.consumeStream();

// Use spanId for efficient Braintrust root span queries
const braintrustRootSpanId = stream.spanId;
```
