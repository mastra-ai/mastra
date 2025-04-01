# Memory Threads

Memory in Mastra is organized using **threads** and **resources**. Understanding these concepts is essential for effectively managing conversation history and user interactions.

## What's a Thread? What's a Resource?

- **Thread**: A conversation context or discussion topic. Each thread represents a separate conversation flow.
- **Resource**: An entity (typically a user) associated with threads. Resources can have multiple conversation threads.

```
┌───────────────┐
│   Resource    │
│   (user_123)  │
└───────┬───────┘
        │
        ▼
┌──────────────────────────────────────┐
│               Threads                │
├──────────────┬──────────┬────────────┤
│ support_001  │ sales_002│ billing_003│
└──────────────┴──────────┴────────────┘
```

This organization enables:
- Managing multiple conversation contexts for a single user
- Retrieving conversation history by thread
- Building conversation user interfaces
- Implementing access control and authentication

## Thread and Resource IDs

When using an agent with memory, you must provide both `resourceId` and `threadId`:

```typescript
await agent.stream("Hello", {
  resourceId: "user_alice", // The entity (user)
  threadId: "support_123",  // The conversation context
});
```

These IDs determine:
- Where messages are stored
- Which conversation history is retrieved
- How working memory is associated with users

## How Agents Interact with Memory Threads

Agents automatically:
1. Save all messages to the specified thread
2. Retrieve relevant message history from the thread
3. Include the history in the context window
4. Associate working memory with the resource

This happens without any additional code when you provide the IDs:

```typescript
// Creating a memory instance
const memory = new Memory();

// Using memory with an agent
const agent = new Agent({
  name: "SupportAgent",
  instructions: "You are a support agent.",
  model: openai("gpt-4o"),
  memory: memory,
});

// Memory is automatically managed when using resourceId and threadId
await agent.stream("I need help with my subscription", {
  resourceId: "customer_456",
  threadId: "support_thread_789",
});
```

Explore the subsections to learn about advanced thread management, multiple user handling, and building admin interfaces for memory threads. 