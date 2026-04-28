---
'@mastra/mcp': minor
---

Added `jsonSchemaValidator` pass-through option on `MCPClient` server entries and `MCPServer`. Forward this option from `@modelcontextprotocol/sdk` to opt into a non-default validator. Pass `CfWorkerJsonSchemaValidator` from `@modelcontextprotocol/sdk/validation/cfworker` to make tools with `outputSchema` work in Cloudflare Workers / V8 isolates, where the default Ajv validator's `new Function(...)` compile path is blocked.

```typescript
import { MCPClient, MCPServer } from '@mastra/mcp';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';

const mcp = new MCPClient({
  servers: {
    upstream: {
      url: new URL('https://example/mcp'),
      jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
    },
  },
});

const server = new MCPServer({
  name: 'My Server',
  version: '1.0.0',
  tools: { ... },
  jsonSchemaValidator: new CfWorkerJsonSchemaValidator(),
});
```

Closes #15862.
