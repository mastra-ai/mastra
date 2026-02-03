---
'@mastra/core': minor
'@mastra/editor': minor
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Created @mastra/editor package for managing and resolving stored agent configurations

This major addition introduces the editor package, which provides a complete solution for storing, versioning, and instantiating agent configurations from a database. The editor seamlessly integrates with Mastra's storage layer to enable dynamic agent management.

**Key Features:**

- **Agent Storage & Retrieval**: Store complete agent configurations including instructions, model settings, tools, workflows, nested agents, scorers, processors, and memory configuration
- **Version Management**: Create and manage multiple versions of agents, with support for activating specific versions
- **Dependency Resolution**: Automatically resolves and instantiates all agent dependencies (tools, workflows, sub-agents, etc.) from the Mastra registry
- **Caching**: Built-in caching for improved performance when repeatedly accessing stored agents
- **Type Safety**: Full TypeScript support with proper typing for stored configurations

**Usage Example:**

```typescript
import { MastraEditor } from '@mastra/editor';
import { Mastra } from '@mastra/core';

// Initialize editor with Mastra
const mastra = new Mastra({
  /* config */
});
const editor = new MastraEditor();
mastra.registerEditor(editor);

// Store an agent configuration
const agentId = await mastra.storage.agents.createAgent({
  name: 'customer-support',
  instructions: 'Help customers with inquiries',
  model: { provider: 'openai', name: 'gpt-4' },
  tools: ['search-kb', 'create-ticket'],
  workflows: ['escalation-flow'],
  memory: { vector: 'pinecone-db' },
});

// Retrieve and use the stored agent
const agent = await editor.getStoredAgentById('customer-support');
const response = await agent.generate('How do I reset my password?');

// List all stored agents
const agents = await editor.listStoredAgents({ pageSize: 10 });
```

**Storage Improvements:**

- Fixed JSONB handling in LibSQL, PostgreSQL, and MongoDB adapters
- Improved agent resolution queries to properly merge version data
- Enhanced type safety for serialized configurations
