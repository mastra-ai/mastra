---
'@mastra/code-sdk': patch
---

Added a `prepareWakeRequestContext` option to `createMastraCode()`. A wake (a notification or cross-agent signal that starts a run on an idle thread) has no inbound request, so hosts that resolve credentials per tenant can use this option to attach the owning identity before the run starts. It is called only when a session owns the target resource.

```ts
const mastraCode = await createMastraCode({
  prepareWakeRequestContext: async ({ requestContext, resourceId }) => {
    const owner = await lookUpOwner(resourceId);
    if (owner) requestContext.set('user', owner);
  },
});
```
