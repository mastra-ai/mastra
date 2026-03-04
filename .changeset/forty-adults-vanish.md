---
'@mastra/core': minor
---

Added `streamParts` to `processOutputResult` args, giving processors direct access to all accumulated stream chunks (including the finish chunk with usage data) after generation completes. Previously, usage data and other chunk metadata were only available in `processOutputStream`.

```typescript
const usageProcessor: Processor = {
  id: 'usage-processor',
  processOutputResult({ streamParts, messages }) {
    const finishChunk = streamParts.find(part => part.type === 'finish');
    if (finishChunk) {
      const usage = finishChunk.payload.output.usage;
      console.log(`Tokens: ${usage.inputTokens} in, ${usage.outputTokens} out`);
    }
    return messages;
  },
};
```
