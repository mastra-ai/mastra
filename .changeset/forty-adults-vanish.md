---
'@mastra/core': minor
---

Added `result` to `processOutputResult` args, providing resolved generation data (usage, text, steps, finishReason) directly. This replaces raw stream chunks with an easy-to-use `OutputResult` object containing the same data available in the `onFinish` callback.

```typescript
const usageProcessor: Processor = {
  id: 'usage-processor',
  processOutputResult({ result, messages }) {
    console.log(`Text: ${result.text}`);
    console.log(`Tokens: ${result.usage.inputTokens} in, ${result.usage.outputTokens} out`);
    console.log(`Finish reason: ${result.finishReason}`);
    console.log(`Steps: ${result.steps.length}`);
    return messages;
  },
};
```
