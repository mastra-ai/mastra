---
"@mastra/core": minor
"@mastra/mcp": patch
---

Add support for dynamic tool descriptions that can access `requestContext` and the Mastra instance.

Tool descriptions may now be plain strings or resolver functions that receive `{ requestContext, mastra }`, matching the existing `DynamicArgument<T>` pattern used for instructions and models. This unlocks multi-tenancy, localization, and feature-flag scenarios without rebuilding tool definitions per request.

**Usage**

```ts
const sqlTool = createTool({
  id: 'tenant-sql',
  description: ({ requestContext }) => {
    const tenant = requestContext.get('tenant');
    return `Query the ${tenant} schema`;
  },
  execute: async (input, { mastra }) => { /* ... */ },
});
```

**Highlights**
- `ToolAction.description` now uses `DynamicToolDescription` (`string | ({ requestContext, mastra }) => string | Promise<string>`).
- `Tool#getDescription()` resolves dynamic descriptions with shared `resolveMaybePromise`.
- Agents resolve descriptions centrally before calling `makeCoreTool`, covering assigned, memory, toolset, and client tools.
- Agent networks resolve dynamic descriptions for routing decisions.
- Workflows keep static descriptions and safely skip dynamic ones at build time.
- CoreToolBuilder, MCP server, and workflow helpers all guard against accessing dynamic getters directly.
- 18 comprehensive tests (14 unit + 4 integration) cover static/dynamic/async cases, raw `ToolAction`s, CoreToolBuilder fallbacks, and empty-string descriptions.

**Bug Fixes**
- Prevented `CoreToolBuilder.getResolvedDescription()` and MCP server registration from throwing when a tool exposes a dynamic description.
- Fixed client tools spread-order bug where `getDescription()` method was lost before resolution.
- Prevented agent network crashes when encountering tools with dynamic descriptions.
- Ensured Agent resolves descriptions for both `Tool` instances and raw `ToolAction` objects, keeping type safety across adapters.
- Treat empty-string descriptions as intentional values instead of falsy fallbacks.

