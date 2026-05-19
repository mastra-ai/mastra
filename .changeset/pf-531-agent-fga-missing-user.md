---
'@mastra/core': patch
---

Fixed agent execution authorization when using a server-side fine-grained access control provider. New `agent.generate(...)` and `agent.stream(...)` calls now require a `user` in `requestContext`; calls without a user are denied with an authorization error before the model runs.

```ts
const requestContext = new RequestContext();
requestContext.set('user', { id: 'user-1' });
await agent.generate('Summarize this', { requestContext });
```

Local agent calls without a configured FGA provider continue to run without requiring a `user` in request context.
