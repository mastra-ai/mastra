---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Added `applySchemaCompatTransformation` option to automatically fix provider-specific schema requirements.

- **New option in `structuredOutput`**: Set `applySchemaCompatTransformation: true` to automatically transform schemas
- **Fixes OpenAI strict mode**: Converts `.optional()` fields to `.nullable()` so all properties are in the required array
- **Fixes nested zod properties under nullable**: Previously `z.optional().nullable()` would not catch the `optional()` for openai schema compatbility layer.

```typescript
await agent.generate('Extract user info', {
  structuredOutput: {
    schema: z.object({
      name: z.string(),
      age: z.number().optional(), // Previously failed with OpenAI strict mode
    }),
    applySchemaCompatTransformation: true, // Fixes compatibility automatically
  },
});
```
