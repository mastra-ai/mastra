---
'@mastra/server': minor
'@mastra/core': minor
---

Added the official Mastra Agent Skills to the built-in MCP server. Coding agents connected to `/api/mcp` that support the MCP Skills extension can load the `mastra` and `mastra-factory` skills, so they work from current Mastra APIs without installing anything. Serving them needs a version of `@mastra/mcp` with skills support. With an older one, the endpoint works as before without them. To turn them off:

```ts
export const mastra = new Mastra({
  server: { mcp: { skills: false } },
});
```
