# @mastra/surrealdb-agent-memory

[SurrealDB Agent Memory](https://surrealdb.com/agent-memory) for Mastra: a memory provider with server-side fact extraction, semantic recall and user profiles, agent tools, and document search for RAG.

## Installation

```bash
npm install @mastra/surrealdb-agent-memory
```

The package also needs `zod` (v3.25 or v4) as a peer dependency. The example below keeps verbatim history in SurrealDB, which needs `@mastra/surrealdb` too:

```bash
npm install @mastra/surrealdb
```

To keep history in memory instead, leave out `storage`.

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { SurrealDBStore } from '@mastra/surrealdb';
import { AgentMemory } from '@mastra/surrealdb-agent-memory';

const agent = new Agent({
  id: 'assistant',
  name: 'assistant',
  instructions: 'You are a helpful assistant with long-term memory.',
  model: 'openai/gpt-5-mini',
  memory: new AgentMemory({
    endpoint: process.env.AGENT_MEMORY_ENDPOINT!,
    context: process.env.AGENT_MEMORY_CONTEXT!,
    apiKey: process.env.AGENT_MEMORY_API_KEY!,
    // Durable verbatim history; omit to keep it in memory.
    storage: new SurrealDBStore({ id: 'storage', url: 'ws://localhost:8000', username: 'root', password: 'root' }),
  }),
});
```

### Agent tools

```typescript
import { AgentMemoryClient, createAgentMemoryTools } from '@mastra/surrealdb-agent-memory';

const client = new AgentMemoryClient({ endpoint, context, apiKey });
const tools = createAgentMemoryTools(client);
```

### Documents

```typescript
import { ingestDocument, searchDocuments } from '@mastra/surrealdb-agent-memory';

await ingestDocument(client, { file, title: 'Handbook' });
const results = await searchDocuments(client, { query: 'refund policy', k: 5 });
```

## Documentation

- [SurrealDB Agent Memory integration guide](https://mastra.ai/integrations/databases/surrealdb-agent-memory)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/stores/surrealdb-agent-memory/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
