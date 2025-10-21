---
'@mastra/core': patch
---

Fix TypeScript type errors when using provider-defined tools from external AI SDK packages.

Agents can now accept provider tools like `google.tools.googleSearch()` without type errors. Creates new `@internal/external-types` package to centralize AI SDK type re-exports and adds `ProviderDefinedTool` structural type to handle tools from different package versions/instances due to TypeScript's module path discrimination.