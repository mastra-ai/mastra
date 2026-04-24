---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added support for resuming suspended agent streams over HTTP with custom data. This adds the `POST /agents/:agentId/resume-stream` server endpoint and the client SDK `agent.resumeStream()` method, so apps can continue a suspended agent run through the Mastra client.

**Usage example (client SDK):**

```typescript
const agent = mastraClient.getAgent('my-agent');

// Resume a suspended agent stream with custom data
const response = await agent.resumeStream(
  { approved: true, selectedOption: 'plan-b' },
  { runId: 'previous-run-id', toolCallId: 'tool-123' }
);

await response.processDataStream({
  onChunk: (chunk) => console.log(chunk),
});
```
