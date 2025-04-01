# Memory Examples

This section provides practical examples of common memory use cases in Mastra. These examples demonstrate how to implement different memory features in real-world scenarios.

## Available Examples

- **[Conversation Example](./conversation.md)**: Basic conversation with message history
- **[Semantic Recall Example](./semantic-recall.md)**: Finding and utilizing relevant past information
- **[Working Memory Example](./working-memory.md)**: Maintaining persistent user information
- **[Frontend Example](./frontend.md)**: Integrating memory with frontend frameworks
- **[Auth Example](./auth.md)**: Using JWT for secure thread management
- **[Database Example](./database.md)**: Configuring different storage backends

## Quick Reference

Here's a quick reference for common memory operations:

### Setting Up Memory with Default Settings

```typescript
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { openai } from "@ai-sdk/openai";

// Create memory with default settings
const memory = new Memory();

// Create an agent with memory
const agent = new Agent({
  name: "Assistant",
  instructions: "You are a helpful assistant.",
  model: openai("gpt-4o"),
  memory: memory,
});
```

### Conversation with Memory

```typescript
// Initialize conversation
await agent.stream("Hello, I'm Robin.", {
  resourceId: "user_robin",
  threadId: "chat_123",
});

// Continue conversation with memory
await agent.stream("What's my name?", {
  resourceId: "user_robin",
  threadId: "chat_123",
});
```

### Working with Multiple Threads

```typescript
// Support thread
await agent.stream("I need help with my subscription", {
  resourceId: "user_robin",
  threadId: "support_456",
});

// Sales thread (same user, different context)
await agent.stream("I'm interested in upgrading my plan", {
  resourceId: "user_robin",
  threadId: "sales_789",
});
```

### Enabling Advanced Features

```typescript
// Create memory with all advanced features
const memory = new Memory({
  options: {
    lastMessages: 20,
    semanticRecall: {
      topK: 3,
      messageRange: 2,
    },
    workingMemory: {
      enabled: true,
    },
  },
});
```

### Managing Threads Programmatically

```typescript
// Create a new thread
const thread = await memory.createThread({
  resourceId: "user_robin",
  title: "Project Discussion",
  metadata: { project: "Mastra" },
});

// Get threads for a user
const threads = await memory.getThreadsByResourceId({
  resourceId: "user_robin",
});

// Get messages from a thread
const { messages } = await memory.query({
  threadId: thread.id,
  selectBy: { last: 10 },
});
```

Explore the specific examples for detailed implementations of different memory features. 