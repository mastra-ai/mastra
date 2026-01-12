---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
---

Add optional `partial` query parameter to `/api/agents` and `/api/workflows` endpoints to return minimal data without schemas, reducing payload size for list views:

- When `partial=true`: tool schemas (inputSchema, outputSchema) are omitted
- When `partial=true`: workflow steps are replaced with stepCount integer
- When `partial=true`: workflow root schemas (inputSchema, outputSchema) are omitted
- Maintains backward compatibility when partial parameter is not provided

**Server Endpoint Usage**

```bash
# Get partial agent data (no tool schemas)
GET /api/agents?partial=true

# Get full agent data (default behavior)
GET /api/agents

# Get partial workflow data (stepCount instead of steps, no schemas)
GET /api/workflows?partial=true

# Get full workflow data (default behavior)
GET /api/workflows
```

**Client SDK Usage**

```typescript
import { MastraClient } from "@mastra/client-js";

const client = new MastraClient({ baseUrl: "http://localhost:4111" });

// Get partial agent list (smaller payload)
const partialAgents = await client.listAgents({ partial: true });

// Get full agent list with tool schemas
const fullAgents = await client.listAgents();

// Get partial workflow list (smaller payload)
const partialWorkflows = await client.listWorkflows({ partial: true });

// Get full workflow list with steps and schemas
const fullWorkflows = await client.listWorkflows();
```
