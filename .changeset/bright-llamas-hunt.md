---
'@mastra/connect': minor
---

Added multi-connection support to `@mastra/connect`: when a provider has multiple active connections, tools are now wrapped with a required `connection_name` input and a new `<provider>_list_connections` tool is exposed so agents can discover and select which connection to use. Single-connection behavior and explicit connectionId pins are unchanged.

**Before:** Multi-active provider connections were skipped with a warning.

**After:**

```ts
const tools = await connect({ integrations: { linear: {} } });

// Agent lists available connections
await tools.linear_list_connections.execute({ context: {} });
// => { connections: [{ name: 'Work' }, { name: 'Personal' }] }

// Agent calls tools with the chosen connection
await tools.linear_get_issue.execute({ context: { connection_name: 'Work', id: 'LIN-123' } });
```
