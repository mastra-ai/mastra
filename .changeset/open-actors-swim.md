---
'@mastra/koa': patch
---

Added `onError` hook support to the Koa adapter. When `server.onError` is configured, errors from route handlers and middleware are routed through the custom handler, giving you control over error response format and status codes. Unhandled errors fall back to a default JSON response.

```ts
const mastra = new Mastra({
  server: {
    onError: (error, c) => {
      return c.json({ message: error.message, code: 'CUSTOM_ERROR' }, 500);
    },
  },
});
```

Also fixed pre-existing failures in the shared server adapter test suite for recently added routes (stored MCP clients, prompt blocks, workspaces, skills, scorer versions, tool providers).
