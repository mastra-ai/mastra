---
'@mastra/sentry': minor
---

Added the `gen_ai.conversation.id` span attribute to the Sentry exporter, sourced from `metadata.threadId`. Spans from the same chat thread now group together in Sentry's Conversations view (part of AI Agent Monitoring).

```typescript
const agent = mastra.getAgent('chat');

// Pass threadId as before — the Sentry exporter now emits it as gen_ai.conversation.id
await agent.generate('Hello', {
  memory: { thread: 'thread-123', resource: 'user-1' },
});
```
