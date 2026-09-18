---
'@mastra/core': minor
---

Added `structuredOutput.instructions` support for JSON prompt injection, so you can replace the serialized JSON schema in the prompt with your own compact instructions

When `jsonPromptInjection` is active and no separate structuring `model` is configured, a caller-supplied `structuredOutput.instructions` string is now injected into the prompt in place of the serialized JSON schema, in both `'system'` and `'inline'` modes. On large schemas this removes thousands of tokens from every model call.

```ts
const result = await agent.generate('Extract the customer name.', {
  structuredOutput: {
    schema: z.object({ name: z.string() }),
    jsonPromptInjection: 'system',
    instructions: 'Return a JSON object with a name field.',
  },
});
```

Output is still validated against `schema`, so you stay responsible for keeping `instructions` in sync with the fields you need. When no separate structuring `model` is configured, `instructions` is also serialized across the durable agent boundary, so the same behavior applies to durable runs. Behavior is unchanged when `instructions` is absent or blank: the serialized schema is still injected as before.
