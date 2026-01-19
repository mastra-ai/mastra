---
'@mastra/core': patch
'@mastra/inngest': patch
---

Add support for typed structured output in agent workflow steps

When wrapping an agent with `createStep()` and providing a `structuredOutput.schema`, the step's `outputSchema` is now correctly inferred from the provided schema instead of defaulting to `{ text: string }`.

This enables type-safe chaining of agent steps with structured output to subsequent steps:

```typescript
const articleSchema = z.object({
  title: z.string(),
  summary: z.string(),
  tags: z.array(z.string()),
});

// Agent step with structured output - outputSchema is now articleSchema
const agentStep = createStep(agent, {
  structuredOutput: { schema: articleSchema },
});

// Next step can receive the structured output directly
const processStep = createStep({
  id: 'process',
  inputSchema: articleSchema, // Matches agent's outputSchema
  outputSchema: z.object({ tagCount: z.number() }),
  execute: async ({ inputData }) => ({
    tagCount: inputData.tags.length, // Fully typed!
  }),
});

workflow.then(agentStep).then(processStep).commit();
```

When `structuredOutput` is not provided, the agent step continues to use the default `{ text: string }` output schema.
