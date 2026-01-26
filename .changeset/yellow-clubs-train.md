---
'mastra': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
---

Added configurable route prefix support across the Mastra stack for servers using custom prefixes (e.g., `/mastra` instead of the default `/api`).

**@mastra/client-js** - Added `prefix` option to `MastraClient`:

```typescript
const client = new MastraClient({
  baseUrl: 'http://localhost:3000',
  prefix: '/mastra'  // Calls /mastra/agents, /mastra/workflows, etc.
});
```

**mastra (CLI)** - Added `--server-prefix` option to `mastra studio`:

```bash
mastra studio --server-port 3000 --server-prefix /mastra
```

**@mastra/server** - Added prefix normalization to handle leading/trailing slashes consistently.

**@mastra/playground-ui** - Added `prefix` field to studio configuration form and context.
