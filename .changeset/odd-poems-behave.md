---
'@mastra/client-js': patch
---

Added `apiPrefix` option to `MastraClient` for connecting to servers with custom API route prefixes.

**Before:** The client always used the `/api` prefix for all endpoints.

**After:** You can now specify a custom prefix when deploying Mastra behind non-default paths:

```typescript
const client = new MastraClient({
  baseUrl: 'http://localhost:3000',
  apiPrefix: '/mastra', // Calls /mastra/agents, /mastra/workflows, etc.
});
```

The default remains `/api` for backward compatibility. See #12261 for more details.
