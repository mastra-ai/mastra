---
'@mastra/client-js': minor
---

Added `getMcpServerResources()` and `readMcpServerResource()` methods to `MastraClient` for listing and reading MCP server resources from the client SDK. These methods enable frontend applications to fetch app resource HTML for interactive MCP Apps rendering.

```ts
const client = new MastraClient();

// List resources on an MCP server
const resources = await client.getMcpServerResources('my-server');

// Read a specific app resource
const resource = await client.readMcpServerResource('my-server', 'ui://calculator/app');
```
