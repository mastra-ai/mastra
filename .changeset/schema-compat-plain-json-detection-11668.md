---
"@mastra/schema-compat": patch
---

Added utility function to detect plain JSON Schema objects.

**What changed:**
- New `isPlainJSONSchema()` utility function that distinguishes plain JSON Schemas from Zod schemas and AI SDK Schemas
- Enables proper handling of plain JSON Schema objects throughout the schema conversion pipeline

**API Addition:**
```typescript
import { isPlainJSONSchema } from '@mastra/schema-compat';

const schema = { type: 'object', properties: { name: { type: 'string' } } };
isPlainJSONSchema(schema); // true
```

Fixes #11668
