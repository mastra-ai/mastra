---
'@mastra/core': patch
'@mastra/ai-sdk': patch
---

Enqueue a `tool-output-denied` chunk when a `requireApproval` tool is declined so live AI SDK clients resolve the pending tool call instead of hanging. Persistence as `output-denied` already worked; only the stream path was missing.

```ts
for await (const part of toAISdkStream(result.fullStream, { from: 'agent' })) {
  if (part.type === 'tool-output-denied') {
    // Clears the pending requireApproval tool call on the client
    console.log('denied', part.toolCallId);
  }
}
```
