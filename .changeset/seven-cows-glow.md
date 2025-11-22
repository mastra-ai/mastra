---
'@mastra/schema-compat': patch
'@mastra/core': patch
---

Added schema compatibility transformations to fix provider-specific schema requirements.

## New Features

- **`processSchema` utilities**: New helper functions for manual schema transformations, exported from `@mastra/core/llm`
  - `processSchema.openai()` - Transform schemas for OpenAI strict mode
  - `processSchema.openaiReasoning()` - Transform schemas for OpenAI reasoning models (o1, o3, o4)
  - `processSchema.anthropic()` - Transform schemas for Anthropic models
  - `processSchema.google()` - Transform schemas for Google models
  - `processSchema.deepseek()` - Transform schemas for DeepSeek models
  - `processSchema.meta()` - Transform schemas for Meta models

## Fixes

- **OpenAI strict mode compatibility**: All `.optional()` fields are now correctly converted to `.nullable()` to ensure all properties are in the required array
- **Nested optional/nullable handling**: Fixed handling of nested combinations like `.optional().nullable()` and `.nullable().optional()` - both now normalize to `.nullable()`
- **Deep optional transformation**: `.optional()` fields are now transformed to `.nullable()` at any nesting level (objects, arrays, unions, etc.)


```typescript
import { processSchema } from '@mastra/core/llm';

const schema = z.object({
  name: z.string(),
  age: z.number().optional(),
});

const openaiSchema = processSchema.openai(schema);
// age is now .nullable() instead of .optional()
```
