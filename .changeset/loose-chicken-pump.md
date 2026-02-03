---
'@mastra/schema-compat': minor
---

Added [Standard Schema](https://github.com/standard-schema/standard-schema) support to `@mastra/schema-compat`. This enables interoperability with any schema library that implements the Standard Schema specification.

**New exports:**

- `toStandardSchema()` - Convert Zod, JSON Schema, or AI SDK schemas to Standard Schema format
- `StandardSchemaWithJSON` - Type for schemas implementing both validation and JSON Schema conversion
- `InferInput`, `InferOutput` - Utility types for type inference

**Example usage:**

```typescript
import { toStandardSchema } from '@mastra/schema-compat/standard-schema';
import { z } from 'zod';

// Convert a Zod schema to Standard Schema
const zodSchema = z.object({ name: z.string(), age: z.number() });
const standardSchema = toStandardSchema(zodSchema);

// Use validation
const result = standardSchema['~standard'].validate({ name: 'John', age: 30 });

// Get JSON Schema
const jsonSchema = standardSchema['~standard'].jsonSchema.output({ target: 'draft-07' });
```
