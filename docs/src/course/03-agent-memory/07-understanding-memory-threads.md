# Managing Conversation History

In this step, we'll learn how to configure conversation history and understand memory threads in Mastra. Conversation history allows your agent to remember recent interactions, which is essential for maintaining context in ongoing conversations.

## Understanding Memory Threads

Mastra organizes memory into threads, which are records that identify specific conversation histories. Each thread uses two important identifiers:

1. **`threadId`**: A specific conversation ID (e.g., `support_123`)
2. **`resourceId`**: The user or entity ID that owns each thread (e.g., `user_alice`)

These identifiers allow memory to work properly outside of the playground. They help Mastra distinguish between different conversations and users, ensuring that the right memory is associated with the right conversation.

Without these identifiers, your agent would have no way to know which conversation history to retrieve when a user sends a message. The playground handles these identifiers automatically, but you'll need to manage them yourself when using memory in your own applications.

## Thread ID Uniqueness

**Important:** Thread IDs must be globally unique across your entire application. Once a thread ID is created with a specific resource ID, that pairing is permanent.

The relationship works like this:
- **One thread → One resource** (a thread always belongs to the same user/entity)
- **One resource → Many threads** (a user can have multiple separate conversations)

If you reuse a thread ID with a different resource ID, you'll encounter an error:
```
Thread with id <thread_id> is for resource with id <resource_a>
but resource <resource_b> was queried
```

### Generating Thread IDs

The safest approach is to use UUIDs or include the resource identifier:

```typescript
// Using UUIDs (recommended)
const threadId = crypto.randomUUID(); // "550e8400-e29b-41d4-a716-446655440000"

// Or combine resource ID with a unique suffix
const threadId = `${resourceId}_${Date.now()}`; // "user_alice_1737907200000"
```

Never reuse simple identifiers like `"conversation_1"` across different resources, as this will cause ID collision errors.
