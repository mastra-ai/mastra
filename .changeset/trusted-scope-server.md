---
'@mastra/server': minor
---

Trace query, thread query, and trace-query discovery routes now resolve a trusted tenant scope from the reserved `organizationId` request-context key and pass it to the planner. Requests from hosts that set that key server-side only see their own organization's traces, related spans, scores, feedback, and discovery values, and cursors are bound to that scope. Without the key the routes behave as before. Scoped requests are rejected with `501` when the installed `@mastra/core` or observability store predates tenant scope, so a scope can never be silently dropped.

Set the key from server-side authentication, for example in server middleware:

```typescript
const mastra = new Mastra({
  server: {
    middleware: [
      async (c, next) => {
        c.get('requestContext').set('organizationId', getSession(c).organizationId)
        await next()
      },
    ],
  },
})
```
