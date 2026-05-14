---
'@mastra/core': minor
---

Moved Harness v1 session permission methods under a `session.permissions.*` namespace and added static-map sugar for tool categories.

- `session.grantCategory/grantTool/revokeCategory/revokeTool/getGrants/getRules/setPolicy` are now reached via `session.permissions.grantCategory(...)` etc. The shape matches spec §4.2e and frees the top-level Session surface for other namespaces (OM, etc.).
- `getGrants()` / `getRules()` now return `Readonly<>` frozen snapshots; mutation throws in strict mode. Read patterns are unchanged.
- `HarnessConfig.toolCategoryResolver: (name) => ToolCategory | null` remains the primary form. `HarnessConfig.toolCategories: Record<string, ToolCategory>` is accepted as optional sugar and desugars to `(name) => toolCategories[name] ?? null`. When both are provided, the resolver wins.

Migration:

```ts
// Before
await session.grantCategory({ category: 'ask' });
const grants = session.getGrants();
await session.setPolicy({ rules });

// After
await session.permissions.grantCategory({ category: 'ask' });
const grants = session.permissions.getGrants();
await session.permissions.setPolicy({ rules });
```
