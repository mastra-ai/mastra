---
'@mastra/code-sdk': minor
---

Added a transport-agnostic adapter that loads a local or GitHub Mastra Code plugin and exposes its tools through an MCP server.

```ts
import { createPluginMCPServer } from '@mastra/code-sdk/plugins/mcp';

const { server } = await createPluginMCPServer({ specifier: '/absolute/path/to/plugin' });
await server.startStdio();
```
