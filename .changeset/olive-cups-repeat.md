---
'@mastra/core': patch
---

Use `structuredOutput.instructions` for JSON prompt injection instead of always embedding the full schema

When `jsonPromptInjection` is active and no separate structuring `model` is configured, a caller-supplied `structuredOutput.instructions` string is now injected into the prompt in place of the serialized JSON schema, in both `'system'` and `'inline'` modes. On large schemas this removes thousands of tokens from every model call. Output is still validated against `schema`, and behavior is unchanged when `instructions` is absent or blank.

```ts
const result = await agent.generate('Extract the customer name.', {
  structuredOutput: {
    schema: z.object({ name: z.string() }),
    jsonPromptInjection: 'system',
    instructions: 'Return a JSON object with a name field.',
  },
});
```

When no separate structuring `model` is configured, `instructions` is also serialized across the durable agent boundary, so the same behavior applies to durable runs.
