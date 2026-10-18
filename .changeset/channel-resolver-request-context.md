---
'@mastra/core': minor
---

Channel `resolveResourceId` and `resolveThreadId` hooks now receive the per-message `requestContext`. Values a channel handler sets before calling `defaultHandler`, such as a tenant id, can be read directly in the resolvers instead of being looked up a second time.

```ts
channels: {
  handlers: {
    onDirectMessage: async (thread, message, defaultHandler, ctx) => {
      ctx.requestContext.set('tenantId', await lookupTenant(thread.channelId));
      await defaultHandler(thread, message);
    },
  },
  resolveResourceId: ({ requestContext }) => `tenant:${requestContext.get('tenantId')}`,
}
```

`requestContext` is a required field on `ResolveResourceIdContext` and `ResolveThreadIdContext`. Code that builds these objects by hand, such as tests that call a resolver directly, now needs to pass one:

```ts
// Before
await resolveResourceId({ platform, thread, message, defaultResourceId });

// After
await resolveResourceId({ platform, thread, message, defaultResourceId, requestContext: new RequestContext() });
```
