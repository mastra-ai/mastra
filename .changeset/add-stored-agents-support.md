---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/server': minor
---

Add stored agents support

Agents can now be stored in the database and loaded at runtime. This lets you persist agent configurations and dynamically create executable Agent instances from storage.

### Before

Agents could only be defined in code:

```typescript
const agent = new Agent({
  name: 'My Agent',
  instructions: 'You are helpful',
  model: openai('gpt-4'),
});
```

### After

Agents can be stored in the database and distinguished by their `source` field:

```typescript
import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

const mastra = new Mastra({
  storage: new LibSQLStore({ url: ':memory:' }),
  tools: { myTool },
  scorers: { myScorer },
});

// Create agent in storage via API or directly
await mastra.getStorage().createAgent({
  agent: {
    id: 'my-agent',
    name: 'My Agent',
    instructions: 'You are helpful',
    model: { provider: 'openai', name: 'gpt-4' },
    tools: { myTool: {} },
    scorers: { myScorer: { sampling: { type: 'ratio', rate: 0.5 } } },
    ownerId: 'user-123', // Optional: for multi-tenant filtering
  },
});

// Load and use the agent
const agent = await mastra.getStoredAgentById('my-agent');
console.log(agent.source); // 'stored' (code-defined agents have source: 'code')
console.log(agent.ownerId); // 'user-123'
const response = await agent.generate({ messages: 'Hello!' });

// List all stored agents with pagination and owner filtering
const { agents, total, hasMore } = await mastra.listStoredAgents({
  page: 0,
  perPage: 10,
  ownerId: 'user-123', // Optional filter
});
```

Also adds a memory registry to Mastra so stored agents can reference memory instances by key.
