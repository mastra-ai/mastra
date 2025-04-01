# Multi-User Context Management

This use case focuses on how Mastra's memory system can handle separate conversations with different users while maintaining the context for each user individually.

**Use Case**: Managing separate conversation threads for different users.

**Why This Matters to Users**:
- It enables building multi-user agents like customer service bots or team assistants that can talk to different people
- It keeps each user's conversation private and separate
- It allows supervisors to access and review conversations from specific users

**Implementation Example**:
```typescript
// Service agent that maintains separate threads per user
const customerAgent = new Agent({
  memory: new Memory(),
});

// User 1 conversation
await customerAgent.stream("How do I update my profile?", {
  threadId: "support_thread_user1",
  resourceId: "user1",
});

// User 2 conversation (separate thread)
await customerAgent.stream("I need help with billing", {
  threadId: "support_thread_user2", 
  resourceId: "user2",
});

// Manager can access all threads for a specific user
const userThreads = await customerAgent.getMemory()?.getThreadsByResourceId({
  resourceId: "user1"
});

// The retrieved threads can be used in various ways:
// - Render a conversation history UI for managers/supervisors
// - Analyze conversation patterns programmatically
// - Allow users to browse their own past conversations
// - Generate reports on user interactions
```

## Key Concepts

The key Mastra concept demonstrated is the separation of:
- **threadId**: For conversation grouping (each conversation gets its own thread)
- **resourceId**: For user identification (connecting threads to specific users)

This separation gives developers the flexibility to organize memory in ways that match their application's needs.

## Common Applications

This pattern is especially useful for:
- Customer support systems where agents handle multiple customers
- Team collaboration tools where conversations need to be isolated
- Educational platforms where instructors might need to see student interactions
- Management dashboards for overseeing multiple user conversations

By utilizing these parameters consistently, applications can maintain separate contexts for each user while still allowing for administrative oversight of user conversations. The thread data you retrieve can be used to build rich administrative interfaces or for programmatic analysis of conversations. 