---
'@mastra/server': minor
'@mastra/core': minor
'@mastra/server-adapters-test-suite': patch
'@mastra/hono': patch
'@mastra/mcp': patch
---

Added the official Mastra Agent Skills to the built-in MCP server. Coding agents connected to `/api/mcp` that support the MCP Skills extension can load the `mastra` and `mastra-factory` skills, so they work from current Mastra APIs without installing anything. The skills need `@mastra/mcp` with skills support. To turn them off:

```ts
export const mastra = new Mastra({
  server: { mcp: { skills: false } },
});
```
