---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Fixed OpenAI schema compatibility when using `agent.generate()` or `agent.stream()` with `structuredOutput`.

## Changes

- **Automatic transformation**: Zod schemas are now automatically transformed for OpenAI strict mode compatibility when using OpenAI models (including reasoning models like o1, o3, o4)
- **Optional field handling**: `.optional()` fields are converted to `.nullable()` with a transform that converts `null` → `undefined`, preserving optional semantics while satisfying OpenAI's strict mode requirements
- **Preserves nullable fields**: Intentionally `.nullable()` fields remain unchanged
- **Deep transformation**: Handles `.optional()` fields at any nesting level (objects, arrays, unions, etc.)
- **JSON Schema objects**: Not transformed, only Zod schemas

## Example

```typescript
const agent = new Agent({
  name: 'data-extractor',
  model: { provider: 'openai', modelId: 'gpt-4o' },
  instructions: 'Extract user information',
});

const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
  deletedAt: z.date().nullable(),
});

// Schema is automatically transformed for OpenAI compatibility
const result = await agent.generate('Extract: John, deleted yesterday', {
  structuredOutput: { schema },
});

// Result: { name: 'John', age: undefined, deletedAt: null }
```