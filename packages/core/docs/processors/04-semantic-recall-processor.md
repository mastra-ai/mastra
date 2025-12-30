> Documentation for the SemanticRecall processor in Mastra, which enables semantic search over conversation history using vector embeddings.

# SemanticRecall

The `SemanticRecall` is a **hybrid processor** that enables semantic search over conversation history using vector embeddings. On input, it performs semantic search to find relevant historical messages. On output, it creates embeddings for new messages to enable future semantic retrieval.

## Usage example

```typescript
import { SemanticRecall } from '@mastra/core/processors';
import { openai } from '@ai-sdk/openai';

const processor = new SemanticRecall({
  storage: memoryStorage,
  vector: vectorStore,
  embedder: openai.embedding('text-embedding-3-small'),
  topK: 5,
  messageRange: 2,
  scope: 'resource',
});
```

## Constructor parameters

### Options

## Returns

## Extended usage example

```typescript title="src/mastra/agents/semantic-memory-agent.ts"
import { Agent } from '@mastra/core/agent';
import { SemanticRecall, MessageHistory } from '@mastra/core/processors';
import { PostgresStorage } from '@mastra/pg';
import { PgVector } from '@mastra/pg';
import { openai } from '@ai-sdk/openai';

const storage = new PostgresStorage({
  connectionString: process.env.DATABASE_URL,
});

const vector = new PgVector({
  connectionString: process.env.DATABASE_URL,
});

const semanticRecall = new SemanticRecall({
  storage,
  vector,
  embedder: openai.embedding('text-embedding-3-small'),
  topK: 5,
  messageRange: { before: 2, after: 1 },
  scope: 'resource',
  threshold: 0.7,
});

export const agent = new Agent({
  name: 'semantic-memory-agent',
  instructions: 'You are a helpful assistant with semantic memory recall',
  model: 'openai:gpt-4o',
  inputProcessors: [semanticRecall, new MessageHistory({ storage, lastMessages: 50 })],
  outputProcessors: [semanticRecall, new MessageHistory({ storage })],
});
```

## Behavior

### Input processing

1. Extracts the user query from the last user message
2. Generates embeddings for the query
3. Performs vector search to find semantically similar messages
4. Retrieves matched messages along with surrounding context (based on `messageRange`)
5. For `scope: 'resource'`, formats cross-thread messages as a system message with timestamps
6. Adds recalled messages with `source: 'memory'` tag

### Output processing

1. Extracts text content from new user and assistant messages
2. Generates embeddings for each message
3. Stores embeddings in the vector store with metadata (message ID, thread ID, resource ID, role, content, timestamp)
4. Uses LRU caching for embeddings to avoid redundant API calls

### Cross-thread recall

When `scope` is set to `'resource'`, the processor can recall messages from other threads. These cross-thread messages are formatted as a system message with timestamps and conversation labels to provide context about when and where the conversation occurred.

## Related

- [Guardrails](/docs/v1/agents/guardrails)
