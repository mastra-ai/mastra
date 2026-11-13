---
'@mastra/surrealdb-agent-memory': minor
---

Added `@mastra/surrealdb-agent-memory`, which connects SurrealDB Agent Memory to Mastra. `AgentMemory` keeps verbatim history in any Mastra store and adds server-side fact extraction, semantic recall and user profiles. The package also includes agent tools (`createAgentMemoryTools`), document helpers for RAG and a sink for observational memory extractors.

```ts
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
    storage: new SurrealDBStore({ id: 'storage', url: 'ws://localhost:8000', username: 'root', password: 'root' }),
  }),
});
```

This replaces the `@surrealdb/mastra-ai/agent-memory` subpath:

```diff
- import { AgentMemory } from '@surrealdb/mastra-ai/agent-memory';
+ import { AgentMemory } from '@mastra/surrealdb-agent-memory';
```

Semantic recall, the agent tools and, with `injectProfile` enabled, the profile added to the system prompt now only read facts from the current resource and thread. Facts are tagged with the scope paths `mastra/resource/<resourceId>` and `mastra/thread/<threadId>`. Facts written by `@surrealdb/mastra-ai` used a different scope layout and are not returned.
