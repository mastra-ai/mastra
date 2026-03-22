---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added agent resume-stream endpoint (`POST /agents/:agentId/resume-stream`) that allows resuming a suspended agent stream with custom data. This enables resuming workflows running within an agent when using the Mastra client SDK over HTTP.

**Usage example (client SDK):**

```typescript
const agent = mastra.agents.get('my-agent');

// Resume a suspended agent stream with custom data
const response = await agent.resumeStream(
  { approved: true, selectedOption: 'plan-b' },
  { runId: 'previous-run-id', toolCallId: 'tool-123' }
);

await response.processDataStream({
  onChunk: (chunk) => console.log(chunk),
});
```
