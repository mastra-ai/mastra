---
'@mastra/core': patch
---

Added a `tool-call-resumed` stream chunk. It is emitted when a suspended or approval-gated tool call resumes, on both regular and durable agents, and comes before that call's `tool-result`. `payload.kind` tells you whether it was a suspension or an approval. Clients can now tell that a suspension was answered even when a sub-agent suspended through a delegation call and the delegation's later result replaces the tool output. Fixes [#24280](https://github.com/mastra-ai/mastra/issues/24280).

```ts
const stream = await agent.resumeStream({ answer: 'yes' }, { runId, toolCallId });

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'tool-call-resumed') {
    markAnswered(chunk.payload.toolCallId);
  }
}
```
