---
'@mastra/mcp': minor
---

Updated the MCP client and server to run on the MCP 2.0 packages. Request context, authentication, logging, and progress behavior are unchanged, so tools that read `context.mcp.extra.authInfo`, send progress, or use elicitation keep working as before.

Tool schemas advertised over MCP no longer declare a draft-07 `$schema` dialect. The MCP 2.0 default validator rejects that dialect, which previously made tools with output schemas fail on the client.

**If you pass a custom schema validator**

The optional `jsonSchemaValidator` option now takes its validator from the MCP packages. Update the import path:

```ts
// Before
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';

// After
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/client/validators/cf-worker';

const mcp = new MCPClient({
  servers: {
    weather: { url: new URL('https://example.com/mcp'), jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  },
});
```

**If you import MCP protocol types directly**

Types re-exported by `@mastra/mcp` (such as `ToolAnnotations`, `LoggingLevel`, and the OAuth helpers) are unchanged and need no edits. Only imports that reached past `@mastra/mcp` into `@modelcontextprotocol/sdk` need repointing to `@modelcontextprotocol/client` or `@modelcontextprotocol/server`.
