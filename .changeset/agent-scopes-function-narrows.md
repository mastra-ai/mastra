---
'@mastra/core': minor
---

An agent's `scopes` function can now narrow or replace a run's scopes. It receives the run's incoming scopes (from the call, `defaultOptions` and request context) and returns the run's final set. A static `scopes` list is still added to the incoming scopes. The function must keep any `resource:` or `thread:` scope it was given; dropping one throws.

```ts
const agent = new Agent({
  id: 'support',
  name: 'Support',
  instructions: 'Answer support questions.',
  model,
  // Keep identity scopes, drop anything else the caller sent, and add the tenant's org.
  scopes: ({ scopes, requestContext }) => [
    ...scopes.filter(scope => typeof scope === 'string' && /^(resource|thread):/.test(scope)),
    `org:${requestContext.get('orgId')}`,
  ],
});
```
