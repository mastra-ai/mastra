---
'@mastra/core': minor
'@mastra/editor': minor
---

Add `BaseToolIntegration` abstract class and a typed `ToolIntegration` registry on `MastraEditor`. New accessors `getToolIntegration`, `getToolIntegrationOrThrow`, and `getToolIntegrations` sit alongside the existing `getToolProvider`/`getToolProviders` (now `@deprecated`) so existing callers keep working. The `MastraEditor` constructor now accepts a `toolIntegrations` array and throws `DuplicateIntegrationError` on conflicting ids.
