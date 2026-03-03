---
'mastracode': minor
---

Added support for dynamic `extraTools` in `createMastraCode`. The `extraTools` option now accepts a function `({ requestContext }) => Record<string, any>` in addition to a static record, enabling conditional tool registration based on the current request context (e.g. model, mode).
