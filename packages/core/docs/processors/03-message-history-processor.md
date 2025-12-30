> Documentation for the MessageHistory processor in Mastra, which handles retrieval and persistence of conversation history.

# MessageHistory

The `MessageHistory` is a **hybrid processor** that handles both retrieval and persistence of message history. On input, it fetches historical messages from storage and prepends them to the conversation. On output, it persists new messages to storage.

## Usage example

```typescript
import { MessageHistory } from '@mastra/core/processors';

const processor = new MessageHistory({
  storage: memoryStorage,
  lastMessages: 50,
});
```

## Constructor parameters

### Options

## Returns

## Extended usage example

```typescript title="src/mastra/agents/memory-agent.ts"
import { Agent } from '@mastra/core/agent';
import { MessageHistory } from '@mastra/core/processors';
import { PostgresStorage } from '@mastra/pg';

const storage = new PostgresStorage({
  connectionString: process.env.DATABASE_URL,
});

export const agent = new Agent({
  name: 'memory-agent',
  instructions: 'You are a helpful assistant with conversation memory',
  model: 'openai:gpt-4o',
  inputProcessors: [
    new MessageHistory({
      storage,
      lastMessages: 100,
    }),
  ],
  outputProcessors: [
    new MessageHistory({
      storage,
    }),
  ],
});
```

## Behavior

### Input processing

1. Retrieves `threadId` from the request context
2. Fetches historical messages from storage (ordered by creation date, descending)
3. Filters out system messages (they should not be stored in the database)
4. Merges historical messages with incoming messages, avoiding duplicates by ID
5. Adds historical messages with `source: 'memory'` tag

### Output processing

1. Retrieves `threadId` from the request context
2. Skips persistence if `readOnly` is set in memory config
3. Filters out incomplete tool calls from messages
4. Persists new user input and assistant response messages to storage
5. Updates the thread's `updatedAt` timestamp

## Related

- [Guardrails](/docs/v1/agents/guardrails)
