---
'@mastra/core': minor
---

Harness v1: move session permission methods under a `session.permissions.*` namespace and accept `HarnessConfig.toolCategories` as static-map sugar for `toolCategoryResolver`.

- `session.grantCategory/grantTool/revokeCategory/revokeTool/getGrants/getRules/setPolicy` are now reached via `session.permissions.grantCategory(...)` etc. The shape matches spec §4.2e and frees the top-level Session surface for other namespaces (OM, etc.).
- `getGrants()` / `getRules()` now return `Readonly<>` frozen snapshots; mutation throws in strict mode. Read patterns are unchanged.
- `HarnessConfig.toolCategoryResolver: (name) => ToolCategory | null` remains the primary form. `HarnessConfig.toolCategories: Record<string, ToolCategory>` is accepted as optional sugar and desugars to `(name) => toolCategories[name] ?? null`. When both are provided, the resolver wins.
