# Persistent Conversation History

**Use Case**: Maintaining conversational context across multiple interactions with the same user.

**Why Users Need This**:
- Enable natural back-and-forth conversations 
- Let users refer to previous questions or answers
- Provide continuity across user sessions

**Implementation Example**:
```typescript
const agent = new Agent({
  memory: new Memory({
    options: {
      lastMessages: 20, // Keep the last 20 messages in context
    }
  }),
});

// Each session uses the same threadId for continuity
await agent.stream("What were we talking about earlier?", {
  threadId: "user123_thread",
  resourceId: "user123",
});
``` 