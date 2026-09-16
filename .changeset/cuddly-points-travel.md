---
'@mastra/connect': minor
---

Added automatic discovery of MCP-backed integrations from the Mastra Platform catalog. Connected MCP providers require no checked-in provider registration: `connect()` discovers their tools through Platform, keeps provider credentials outside the application process, and preserves Platform proxy analytics. Discovered MCP tools require tool approval unless the application lists them in `autoApproveTools`.

```ts
import { connect } from '@mastra/connect';

const tools = connect({
  projectId: process.env.MASTRA_PROJECT_ID,
  client: { accessToken: process.env.MASTRA_PLATFORM_ACCESS_TOKEN },
  integrations: {
    // An MCP-backed integration attached to the project; tools are discovered at runtime.
    neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
  },
});
```
