---
'@mastra/core': patch
---

Setting `toolChoice: 'none'` now keeps earlier tool calls and results in the conversation, so the model can give a final text answer based on them. Amazon Bedrock no longer drops that tool history or rejects extended-thinking blocks.

```ts
prepareStep: ({ stepNumber }) => (stepNumber >= 3 ? { toolChoice: 'none' } : undefined)
```

Tools are still left out when the step sends a structured-output schema as the response format, because some providers (such as Gemini) reject tools combined with it.
