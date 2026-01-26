---
'mastra': minor
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/server': patch
---

Added `--server-prefix` option to `mastra studio` command to support connecting to Mastra servers with custom route prefixes (e.g., `/mastra` instead of the default `/api`). This enables local studio to work with custom server configurations like Hono adapters using non-default prefixes.

**Example usage:**

```bash
# Server running with prefix '/mastra' on port 3000
mastra studio --server-port 3000 --server-prefix /mastra
```

Also fixed the instance status check to use the prefixed endpoint when verifying server connectivity, ensuring the configuration form only appears when truly needed.
