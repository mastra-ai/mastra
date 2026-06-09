---
'@mastra/claude': minor
'@mastra/cursor': minor
'@mastra/openai': minor
---

Added structured output support for Claude and OpenAI SDK agents using their provider-native structured output APIs. Cursor SDK agent calls now fail clearly when structuredOutput is requested because the Cursor TypeScript SDK does not expose a schema-constrained output API. SDK agents now implement provider-native resume through Mastra's existing resumeGenerate/resumeStream methods by accepting provider-specific resumeData with a message payload. Cursor SDK agent options now use the same clear source split as OpenAI: pass either a pre-created agent or SDK options for wrapper-created agents.

Example:

```ts
await claudeAgent.resumeGenerate({
  message: 'Continue the task.',
  sessionId: 'claude-session-id',
});

await openAIAgent.resumeStream({
  message: 'Continue the task.',
  previousResponseId: 'resp_123',
});

const result = await openAIAgent.generate('Return the answer as JSON.', {
  structuredOutput: {
    schema: z.object({ answer: z.string() }),
  },
});
// result.object has shape { answer: string }
```

Claude and OpenAI SDK agents support `structuredOutput` through their native SDK APIs. `CursorSDKAgent` throws a clear error when `structuredOutput` is requested because the Cursor TypeScript SDK does not expose schema-constrained output.
