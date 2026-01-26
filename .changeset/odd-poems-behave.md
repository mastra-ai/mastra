---
'@mastra/client-js': patch
---

Added `apiPrefix` option to `MastraClient` for connecting to servers with custom API route prefixes.

```typescript
const client = new MastraClient({
  baseUrl: 'http://localhost:3000',
  apiPrefix: '/mastra', // Calls /mastra/agents, /mastra/workflows, etc.
});
```
