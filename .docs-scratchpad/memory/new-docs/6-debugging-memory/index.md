# Debugging Memory

When working with memory in Mastra, you may encounter issues that require debugging. This section covers common problems, troubleshooting techniques, and tools for diagnosing memory-related issues.

## Common Issues and Solutions

### 1. Memory Not Being Retrieved

**Symptoms:**
- Agent doesn't remember previous conversations
- Context seems missing

**Possible Causes:**
- Inconsistent `resourceId` or `threadId`
- Storage connection issues
- Memory configuration problems

**Solutions:**
- Verify that you're using the same `resourceId` and `threadId` across calls
- Check storage connection credentials
- Ensure memory is properly configured and attached to the agent

```typescript
// Incorrect (inconsistent IDs)
await agent.stream("Hello", { resourceId: "user_1", threadId: "thread_a" });
await agent.stream("Follow-up", { resourceId: "user_1", threadId: "thread_b" }); // Different thread!

// Correct (consistent IDs)
await agent.stream("Hello", { resourceId: "user_1", threadId: "thread_a" });
await agent.stream("Follow-up", { resourceId: "user_1", threadId: "thread_a" });
```

### 2. Context Window Overflows

**Symptoms:**
- Token limit errors
- Model refuses to respond with "context too long" messages

**Possible Causes:**
- Too many messages included in context
- Working memory too large
- Semantic search returning too many results

**Solutions:**
- Reduce `lastMessages` count
- Limit semantic search with smaller `topK` and `messageRange`
- Optimize working memory template

```typescript
const memory = new Memory({
  options: {
    lastMessages: 10, // Reduce from default 40
    semanticRecall: {
      topK: 2, // Fewer semantic search results
      messageRange: 1, // Less context around matches
    },
  },
});
```

### 3. Working Memory Not Updating

**Symptoms:**
- Agent doesn't remember user preferences/information
- Working memory tags visible in output

**Possible Causes:**
- Working memory not enabled
- Tags not being properly masked
- Incompatible memory mode with streaming

**Solutions:**
- Verify working memory is enabled
- Ensure you're using `maskStreamTags` utility
- Check mode compatibility with your stream handling

```typescript
// Ensure working memory is enabled
const memory = new Memory({
  options: {
    workingMemory: {
      enabled: true,
    },
  },
});

// Properly mask tags
for await (const chunk of maskStreamTags(response.textStream, "working_memory")) {
  process.stdout.write(chunk);
}
```

## Viewing Thread Data for Debugging

You can directly query memory to examine thread data for debugging:

```typescript
// Get a thread by ID
const thread = await memory.getThreadById({
  threadId: "thread_123",
});
console.log("Thread:", thread);

// Get all messages in a thread
const { messages } = await memory.query({
  threadId: "thread_123",
  selectBy: { all: true },
});
console.log("All messages:", messages);

// Check working memory state
const { workingMemory } = await memory.getWorkingMemory({
  resourceId: "user_456",
});
console.log("Working memory:", workingMemory);
```

## Troubleshooting Semantic Search

When semantic search isn't returning expected results:

### 1. Check Vector Storage

Verify that embeddings are being stored correctly:

```typescript
// Check vector storage content
const { messages } = await memory.query({
  threadId: "thread_123",
  selectBy: {
    vectorSearchString: "test query",
  },
  debug: true, // Enable debug output for vector search
});
```

### 2. Embedding Issues

If results seem irrelevant, there might be issues with the embedding model:

```typescript
// Try a different embedding model
const memory = new Memory({
  embedder: openai.embedding("text-embedding-3-small"),
});
```

### 3. Content-Specific Problems

Sometimes specific content types can cause embedding issues:

- Code snippets may not embed well
- Messages in different languages may have poor similarity
- Very short messages may not have enough semantic content

Adjust your semantic recall settings to account for these challenges:

```typescript
const memory = new Memory({
  options: {
    semanticRecall: {
      topK: 5, // Retrieve more candidates
      messageRange: {
        before: 3, // More context before matches
        after: 3, // More context after matches
      },
    },
  },
});
```

## Logging Memory Operations

Enable debug logging to see memory operations:

```typescript
import { createLogger } from "@mastra/core/logger";

const logger = createLogger({
  name: "Memory",
  level: "debug", // Set to debug for verbose logging
});

const memory = new Memory();
memory.__setLogger(logger);
```

This will output detailed logs about memory operations, including:
- Thread creation and updates
- Message storage
- Semantic search operations
- Working memory updates

These logs can be invaluable for diagnosing complex memory issues. 