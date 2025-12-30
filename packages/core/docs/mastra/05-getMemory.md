> Documentation for the `Mastra.getMemory()` method in Mastra, which retrieves a registered memory instance by its registry key.

# Mastra.getMemory()

The `.getMemory()` method retrieves a memory instance from the Mastra registry by its key. Memory instances are registered in the Mastra constructor and can be referenced by stored agents.

## Usage example

```typescript
const memory = mastra.getMemory('conversationMemory');

// Use the memory instance
const thread = await memory.createThread({
  resourceId: 'user-123',
  title: 'New Conversation',
});
```

## Parameters

## Returns

## Example: Registering and Retrieving Memory

```typescript
import { Mastra } from '@mastra/core';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';

const conversationMemory = new Memory({
  storage: new LibSQLStore({ url: ':memory:' }),
});

const mastra = new Mastra({
  memory: {
    conversationMemory,
  },
});

// Later, retrieve the memory instance
const memory = mastra.getMemory('conversationMemory');
```

## Related

- [Mastra.listMemory()](/reference/v1/core/listMemory)
- [Memory overview](/docs/v1/memory/overview)
- [Agent Memory](/docs/v1/agents/agent-memory)
