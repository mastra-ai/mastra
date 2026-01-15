---
"@mastra/core": minor
"@mastra/server": minor
"@mastra/pg": minor
"@mastra/libsql": minor
"@mastra/mongodb": minor
"@mastra/client-js": minor
"@mastra/playground-ui": minor
---

Add AgentCMS: Full CRUD for managing agents from the Studio UI with versioning support

Agents can now be stored in the database and managed through the Mastra Studio UI. This enables dynamic agent creation, editing, and versioning without code changes.

## Key Features

### Stored Agents
- Create, update, and delete agents via the Studio UI or API
- Distinguish code-defined vs stored agents via the `source` field (`'code'` or `'stored'`)
- Multi-tenant filtering with `ownerId` field
- Metadata filtering for advanced queries

### Agent Versioning
- Automatic version creation on agent updates
- Version history with diff comparison
- Activate any previous version
- Restore agent to a previous version's configuration
- Configurable retention limit (default: 50 versions)

## Usage

### Stored Agents

```typescript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({ url: ':memory:' }),
  tools: { myTool },
  scorers: { myScorer },
});

// Create agent in storage
const agent = await mastra.createStoredAgent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'You are helpful',
  model: { provider: 'openai', name: 'gpt-4' },
  tools: ['myTool'],
  ownerId: 'user-123', // Optional: for multi-tenant filtering
});

// Load and use the agent
const storedAgent = await mastra.getStoredAgentById('my-agent');
console.log(storedAgent.source); // 'stored'
const response = await storedAgent.generate({ messages: 'Hello!' });

// List agents with filtering
const { agents } = await mastra.listStoredAgents({
  ownerId: 'user-123',
  metadata: { team: 'engineering' },
});
```

### Agent Versions (via client-js)

```typescript
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({ baseUrl: 'http://localhost:4111' });

// List versions for an agent
const { versions } = await client.getAgentVersions('my-agent');

// Compare two versions
const diff = await client.compareAgentVersions('my-agent', {
  from: 'version-1-id',
  to: 'version-2-id',
});

// Activate a specific version
await client.activateAgentVersion('my-agent', 'version-id');

// Restore to a previous version (creates new version with old config)
await client.restoreAgentVersion('my-agent', 'version-id');
```

### React Hooks (playground-ui)

```typescript
import { useStoredAgents, useStoredAgent, useStoredAgentMutations } from '@mastra/playground-ui';

// List stored agents with pagination
const { data, isLoading } = useStoredAgents({ page: 0, perPage: 10 });

// Get a specific stored agent
const { data: agent } = useStoredAgent('my-agent');

// Create/update/delete mutations
const { createAgent, updateAgent, deleteAgent } = useStoredAgentMutations();
```
