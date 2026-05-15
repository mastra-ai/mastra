---
'@mastra/core': minor
---

Added consistent FGA execution checks across agents, tools, memory, and workflows to prevent unauthenticated executions when FGA is configured. Pass an authenticated user through `requestContext` when invoking protected APIs directly:

```ts
const requestContext = new RequestContext();
requestContext.set('user', user);

await agent.generate('Summarize this thread', {
  requestContext,
});
```
