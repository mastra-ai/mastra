---
'@mastra/core': minor
---

support inline JSON prompt injection

Added `structuredOutput.jsonPromptInjection: 'inline'` to
append JSON schema instructions to the latest user message
instead of the system prompt. This helps keep the system
prompt stable on providers that cache prompt prefixes.

```ts
await agent.generate('Summarize this text', {
  structuredOutput: {
    schema,
    jsonPromptInjection: 'inline',
  },
});
```
