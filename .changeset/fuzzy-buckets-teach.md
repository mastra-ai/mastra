---
'@mastra/mcp': patch
---

Added `stderr` and `cwd` options to stdio server configuration so you can control child process error output and set the server working directory.

```ts
import { MCPClient } from "@mastra/mcp";

const mcp = new MCPClient({
  servers: {
    myServer: {
      command: "node",
      args: ["server.js"],
      stderr: "pipe",
      cwd: "/path/to/server",
    },
  },
});
```
