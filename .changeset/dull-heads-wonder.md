---
'@mastra/mcp': minor
---

Added requestContext support to the custom fetch option in MCP client HTTP server definitions. The fetch function now receives the current request context as an optional third argument, enabling users to forward authentication cookies, bearer tokens, and other request-scoped data from the incoming request to remote MCP servers during tool execution.

**Example usage:**

```typescript
const mcp = new MCPClient({
  servers: {
    myServer: {
      url: new URL('https://api.example.com/mcp'),
      fetch: async (url, init, requestContext) => {
        const headers = new Headers(init?.headers);
        const cookie = requestContext?.get('cookie');
        if (cookie) {
          headers.set('cookie', cookie);
        }
        return fetch(url, { ...init, headers });
      },
    },
  },
});
```

This change is fully backward-compatible — existing fetch functions with `(url, init)` signatures continue to work unchanged. Closes #13769.
