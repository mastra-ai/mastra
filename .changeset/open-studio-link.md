---
'@mastra/core': minor
'@mastra/server': minor
---

Added `server.mcp.studioUrl` for the built-in MCP server. MCP Apps use it for their **Open in Studio** button. With `mastra dev` it defaults to the local Studio; set it to your deployed Studio's URL, or `false` to hide the button.

```typescript title="src/mastra/index.ts"
export const mastra = new Mastra({
  server: {
    mcp: { studioUrl: 'https://studio.example.com' },
  },
})
```
