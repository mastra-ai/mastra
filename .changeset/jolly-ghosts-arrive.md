---
'@mastra/core': patch
---

Added `isProviderRegistered` to the package's public exports. This was previously available internally and is now reachable for callers that need to check whether a model provider has been registered in the runtime.

Improved client tool schema handling in the tool builder by normalizing raw JSON Schema objects passed as `inputSchema` / `outputSchema` into a `StandardSchemaWithJSON` shape. Tools defined with plain JSON Schema now convert correctly to AI SDK and provider tool formats, matching the behavior of tools defined with Zod.
