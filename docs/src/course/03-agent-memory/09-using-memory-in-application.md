# Using Memory in Your Application

When using memory in your own application (outside the playground), you need to provide a thread ID and a resource ID with each agent call. Pass them through the `memory` option:

```typescript
// Example of using memory in your application
const response = await memoryAgent.stream('Hello, my name is Alice.', {
  memory: {
    thread: 'conversation_123',
    resource: 'user_alice',
  },
})
```

**Important:** Without the thread and resource IDs, your agent will not use memory, even if memory is properly configured. The playground handles this for you, but you need to add the IDs yourself when using memory in your application.

The `resource` should be a unique identifier for the user or entity that owns the conversation. This could be a user ID from your authentication system, an email address, or any other unique identifier.

The `thread` should be a unique identifier for the specific conversation. This allows a single user to have multiple separate conversations with your agent, each with its own memory thread.

In a real application, you might generate these IDs when a user starts a new conversation and store them in your database or client-side storage to reuse in subsequent requests.
