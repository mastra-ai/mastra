# Memory Threads and Resources

Mastra's memory system is organized around **threads** and **resources**. This architecture provides an efficient way to manage conversations for multiple users while maintaining separate contexts.

## Understanding Resources and Threads

In Mastra, memory organization is built around two key concepts:

1. **resourceId**: Identifies the user or entity (e.g., "user_123")
2. **threadId**: Identifies a specific conversation thread (e.g., "support_456")

This separation allows you to:
- Maintain separate conversations for each user
- Track multiple conversation threads per user
- Prevent context bleed between users
- Build multi-user applications with isolated memory

```
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  Resource A   │     │  Resource B   │     │  Resource C   │
│ (User 123)    │     │ (User 456)    │     │ (User 789)    │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Threads    │     │   Threads    │     │   Threads    │
├──────────────┤     ├──────────────┤     ├──────────────┤
│ Thread A-1   │     │ Thread B-1   │     │ Thread C-1   │
│ Thread A-2   │     │ Thread B-2   │     │ Thread C-2   │
│ Thread A-3   │     │              │     │ Thread C-3   │
└──────────────┘     └──────────────┘     └──────────────┘
```

Each thread maintains its own set of messages and working memory:

```
┌─────────────────┐
│    Thread A-1   │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────────┐
│           Messages               │
├──────────────────────────────────┤
│ User: "Hello"                    │
│ Assistant: "Hi there!"           │
│ User: "Can you help me?"         │
│ Assistant: "Sure, how can I help?│
└──────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│         Working Memory           │
├──────────────────────────────────┤
│ User preferences                 │
│ Conversation context             │
│ Other persistent data            │
└──────────────────────────────────┘
```

## Basic Multi-User Implementation

Setting up memory for multiple users is straightforward:

```typescript
import { Memory } from "@mastra/memory";
import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";

// Single memory instance for all users
const memory = new Memory();
const agent = new Agent({
  name: "SupportAgent",
  instructions: "You provide customer support.",
  model: openai("gpt-4o"),
  memory,
});

// Use with different users
await agent.stream("I need help with my account", {
  resourceId: "user_alice",  // First user
  threadId: "support_thread_1",
});

await agent.stream("How do I upgrade my plan?", {
  resourceId: "user_bob",    // Second user (isolated)
  threadId: "support_thread_2",
});

// Continue conversation with first user
await agent.stream("Did you find a solution to my problem?", {
  resourceId: "user_alice",
  threadId: "support_thread_1",
});
```

## Multiple Threads Per User

Users can have multiple conversation threads for different topics:

```typescript
const userId = "user_charlie";

// Support conversation
await agent.stream("I need help with billing", {
  resourceId: userId,
  threadId: "support_thread",
});

// Product feedback conversation (separate context)
await agent.stream("I have some suggestions for your product", {
  resourceId: userId,
  threadId: "feedback_thread",
});

// Continue support conversation with context intact
await agent.stream("Did you find my billing issue?", {
  resourceId: userId,
  threadId: "support_thread",
});
```

## Working Memory and Threads

Working memory is isolated by threadId, ensuring each conversation thread has its own persistent information. This means:

- Each thread maintains its own context and state
- Information stored in working memory for one thread is not accessible to other threads
- You can manage different topics or contexts in separate threads even for the same user

Working memory lets your agent maintain continuously relevant information, such as user preferences, conversation context, or other important data throughout the conversation.

For more details on how to use working memory effectively, see the [Working Memory documentation](../3-using-memory/3.3-working-memory.md).

## Thread Management and Retrieval

You can programmatically access and manage user threads, which is essential for building interactive chat applications:

```typescript
// Get all threads for a specific user
const threads = await memory.getThreadsByResourceId({
  resourceId: "user_alice",
});

// Display thread information
console.log(`User Alice has ${threads.length} conversation threads`);
threads.forEach(thread => {
  console.log(`- ${thread.id}: ${thread.title || 'Untitled'}`);
});
```

Common use cases for thread management include:

- **Building chat UIs**: Showing users a list of their previous conversations
- **Creating conversation history**: Allowing users to switch between different conversation threads
- **Managing conversation lifecycle**: Creating new threads, archiving old ones, or deleting conversations
- **Building admin interfaces**: Creating tools for support staff to access and manage user conversations

For example, in a chat application, you might list all of a user's conversations in a sidebar, allowing them to click on any thread to continue that specific conversation.

## Memory Sharing Between Agents

You can control whether agents share memory or have isolated contexts:

```typescript
// Agents with isolated memory (different threadIds)
await agentA.stream("Message for Agent A", {
  resourceId: "user_123",
  threadId: "conversation_with_agent_A",
});

await agentB.stream("Message for Agent B", {
  resourceId: "user_123", 
  threadId: "conversation_with_agent_B",
});

// Agents with shared memory (same resourceId and threadId)
await specialistAgent.stream("The user has a premium account", {
  resourceId: "user_123",
  threadId: "support_thread_456",
});

await generalAgent.stream("What type of account does the user have?", {
  resourceId: "user_123",
  threadId: "support_thread_456",
}); 
// Second agent will know about the premium account information
```

## Common Issues and Troubleshooting

Here are some common issues related to thread and resource management:

### Missing or Incorrect IDs

**Problem**: Agent doesn't remember previous conversations.

**Potential causes**:
- Using different resource/thread ID combinations for the same conversation
- Forgetting to pass IDs in some requests
- Using inconsistent ID formats

**Solutions**:
- Store and consistently reuse the same IDs for the same conversations
- Add IDs to all agent requests that should share memory
- Check your storage implementation to confirm messages are being saved correctly

### Memory Isolation Issues

**Problem**: Agent mixes up conversations or users.

**Potential causes**:
- Using the same thread ID across different resources
- Using generic IDs that might collide

**Solutions**:
- Ensure thread IDs are unique per resource
- Create a systematic approach to ID generation in your application

### Message Duplication Issues

**Problem**: Duplicate messages, out-of-order messages, or tool calls appearing in the wrong sequence.

**Potential causes**:
- Manually tracking message history and passing it back to the agent
- Using frontend frameworks that send all messages in every request

**Solutions**:
Let Mastra automatically handle message storage and retrieval:

#### Single Message Approach
```typescript
// ✅ CORRECT: Send only the new message each time
// First request:
await agent.stream("First message", {
  resourceId: "user_123",
  threadId: "thread_abc",
});

// Later in your code or in a different request:
await agent.stream("Second message", {
  resourceId: "user_123",
  threadId: "thread_abc",
});

// ❌ INCORRECT: Sending all previous messages
await agent.stream([
  { role: "user", content: "First message" },      // Will be duplicated!
  { role: "assistant", content: "First response" }, // Will be duplicated!
  { role: "user", content: "Second message" }      // Only this should be sent
], {
  resourceId: "user_123",
  threadId: "thread_abc",
});

// ✅ CORRECT: When using frameworks that send message arrays,
// modify your code to only send the newest message
await agent.stream([
  { role: "user", content: "Only the new message" }
], {
  resourceId: "user_123",
  threadId: "thread_abc",
});
```

> **Key Point**: With proper resource and thread IDs, Mastra automatically manages conversation history. You only need to send new messages with each request.

Explore the subsections to learn about advanced thread management, multiple user handling, and building admin interfaces for memory threads.

---

## Related Content

- [Memory Overview](../1-overview/index.md) - Understand the fundamentals of memory in Mastra
- [Getting Started with Memory](../2-getting-started/index.md) - Learn how to set up memory for your agents
- [Multiple Users](./4.3-multiple-users.md) - Scale your agents to handle multiple users