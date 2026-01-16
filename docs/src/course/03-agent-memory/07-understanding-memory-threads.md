# Managing Conversation History

In this step, we'll learn how to configure conversation history and understand memory threads in Mastra. Conversation history allows your agent to remember recent interactions, which is essential for maintaining context in ongoing conversations.

## Understanding Memory Threads

Mastra organizes memory into threads, which are records that identify specific conversation histories. Each thread uses two important identifiers:

1. **`threadId`**: A specific conversation ID (e.g., `support_123`)
2. **`resourceId`**: The user or entity ID that owns each thread (e.g., `user_alice`)

These identifiers allow memory to work properly outside of the playground. They help Mastra distinguish between different conversations and users, ensuring that the right memory is associated with the right conversation.

Without these identifiers, your agent would have no way to know which conversation history to retrieve when a user sends a message. The playground handles these identifiers automatically, but you'll need to manage them yourself when using memory in your own applications.

## Thread ID and Resource ID Relationship

**Important:** Each thread has an owner (its `resourceId`) that is set when the thread is created. Once created, a thread's owner cannot be changed.

The relationship works like this:

- **One thread → One owner** (each thread has exactly one `resourceId` that identifies its owner)
- **One resource → Many threads** (a user can have multiple separate conversations)
- **One thread → Messages with different resourceIds** (messages can have varying `resourceId` values for attribution and filtering purposes)

### Common Pitfall: Thread ID Reuse

If you create a thread with `threadId: "abc"` and `resourceId: "user-alice"`, you cannot later query or create another thread with `threadId: "abc"` but `resourceId: "user-bob"`. This will cause an error:

```text
Thread with id <thread_id> is for resource with id <resource_a>
but resource <resource_b> was queried
```

This error means you're trying to access a thread with the wrong owner's ID. Thread IDs are database primary keys and must be globally unique - you cannot reuse the same thread ID for different thread owners.

### Generating Thread IDs

The safest approach is to use UUIDs to avoid accidentally reusing thread IDs:

```typescript
// Using UUIDs (recommended)
const threadId = crypto.randomUUID(); // "550e8400-e29b-41d4-a716-446655440000"

// Or combine resource ID with a unique suffix
const threadId = `${resourceId}_${Date.now()}`; // "user_alice_1737907200000"
```

Avoid reusing simple identifiers like `"conversation_1"` for threads owned by different users, as this creates confusion about thread ownership.
