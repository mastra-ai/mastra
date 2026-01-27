---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/playground-ui': minor
'@mastra/client-js': minor
'@mastra/pg': minor
'@mastra/libsql': minor
'@mastra/mongodb': minor
'@mastra/cloudflare': minor
'@mastra/clickhouse': minor
'@mastra/deployer': minor
'mastra': patch
---

Added dynamic agent management with CRUD operations and version tracking

**New Features:**

- Create, edit, and delete agents directly from the Mastra Studio UI
- Full version history for agents with compare and restore capabilities
- Visual diff viewer to compare agent configurations across versions
- Agent creation modal with comprehensive configuration options (model selection, instructions, tools, workflows, sub-agents, memory)
- AI-powered instruction enhancement

**Storage:**

- New storage interfaces for stored agents and agent versions
- PostgreSQL, LibSQL, and MongoDB implementations included
- In-memory storage for development and testing

**API:**

- RESTful endpoints for agent CRUD operations
- Version management endpoints (create, list, activate, restore, delete, compare)
- Automatic versioning on agent updates when enabled

**Client SDK:**

- JavaScript client with full support for stored agents and versions
- Type-safe methods for all CRUD and version operations

**Usage Example:**

```typescript
// Server-side: Configure storage
import { Mastra } from '@mastra/core';
import { PgAgentsStorage } from '@mastra/pg';

const mastra = new Mastra({
  agents: { agentOne },
  storage: {
    agents: new PgAgentsStorage({
      connectionString: process.env.DATABASE_URL,
    }),
  },
});

// Client-side: Use the SDK
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:3000' });

// Create a stored agent
const agent = await client.createStoredAgent({
  name: 'Customer Support Agent',
  description: 'Handles customer inquiries',
  model: { provider: 'ANTHROPIC', name: 'claude-sonnet-4-5' },
  instructions: 'You are a helpful customer support agent...',
  tools: ['search', 'email'],
});

// Create a version snapshot
await client.storedAgent(agent.id).createVersion({
  name: 'v1.0 - Initial release',
  changeMessage: 'First production version',
});

// Compare versions
const diff = await client.storedAgent(agent.id).compareVersions('version-1', 'version-2');
```

**Why:**
This feature enables teams to manage agents dynamically without code changes, making it easier to iterate on agent configurations and maintain a complete audit trail of changes.
