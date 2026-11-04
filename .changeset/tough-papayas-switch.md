---
'@mastra/mcp-apps-components': minor
---

Added `projectId` to the dashboard renderer's input, for servers that read observability data for many projects. When it is set, the dashboard adds it to every data tool call as the `_mastraProjectId` argument, so the server knows which project to read. Dashboards without `projectId` send the same tool calls as before.

The tool names, routes and argument key are now also exported from `@mastra/mcp-apps-components/observability-protocol`, which has no server dependencies.

```typescript
import { OBSERVABILITY_PROJECT_ID_ARGUMENT } from '@mastra/mcp-apps-components/observability-protocol';

// In a tool linked to the dashboard app:
execute: async () => ({ definition, scope: 'project', projectId: 'my-project' }),

// In each of the server's data tools:
const { [OBSERVABILITY_PROJECT_ID_ARGUMENT]: projectId, ...query } = input;
```
