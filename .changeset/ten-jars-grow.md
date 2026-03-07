---
'@mastra/core': patch
---

Added an `asJsonSchema` helper to `@mastra/core/utils/zod-to-json` for safe conversion of Zod, AI SDK schema wrappers, and plain JSON Schema objects.

**Example**

    import { asJsonSchema } from '@mastra/core/utils/zod-to-json';
    import { z } from 'zod';

    const schema = asJsonSchema(z.object({ query: z.string() }));
