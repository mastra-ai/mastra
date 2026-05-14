---
'@mastra/core': patch
---

Added `isProviderRegistered` to the package's public exports. This was previously available internally and is now reachable for callers that need to check whether a model provider has been registered in the runtime.

```typescript
import { isProviderRegistered } from '@mastra/core';

if (isProviderRegistered('openai')) {
  // Provider is available
}
```

Improved client tool schema handling in the tool builder by normalizing raw JSON Schema objects passed as `inputSchema` into a `StandardSchemaWithJSON` shape. Client tools whose `inputSchema` arrives as plain JSON (e.g. after crossing the wire from a browser SDK) now convert correctly to AI SDK and provider tool formats, matching the behavior of tools defined with Zod.
