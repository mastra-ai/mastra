---
'@mastra/core': patch
---

Fix the `createHandler` option type on `registerApiRoute`. It's called with `{ mastra }` at runtime but was typed as `(c: Context)`; it's now `(opts: { mastra: Mastra }) => Promise<ApiRouteHandler>`, matching the runtime and the internal `ApiRoute` type.
