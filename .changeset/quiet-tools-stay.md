---
'@mastra/core': patch
---

Fixed `toolChoice: 'none'` removing tool definitions from the model request. Tools are now still sent with a `none` tool choice, matching the AI SDK, so providers such as Amazon Bedrock keep earlier tool calls and results in the conversation (and no longer reject extended-thinking blocks). This keeps the common pattern of forcing a final text answer with `prepareStep` or `processInputStep` working:

```ts
prepareStep: ({ stepNumber }) => (stepNumber >= 3 ? { toolChoice: 'none' } : undefined)
```

Tools are still left out when the step also sends a structured-output schema, because some providers (such as Gemini) reject tools combined with a JSON response format.
