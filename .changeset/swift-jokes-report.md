---
'@mastra/core': patch
---

Fixed `@mastra/core` crashing when a project loads Mastra as CommonJS. Several ESM-only dependencies were read as a module object instead of a function, so the calls threw.

**What failed before**

- `new MCPServer(...)` threw `slugify is not a function`.
- `mastra.schedules.create()` threw the same error.
- Workspace search, workspace file indexing, and batch trace scoring threw `p_map.default is not a function`.

All of these paths now run under CommonJS and ESM. See [#20354](https://github.com/mastra-ai/mastra/issues/20354).
