---
'@mastra/code-sdk': patch
---

Added a `resumeWakeSession` option to `createMastraCode`. It runs when a notification is due on a thread whose session isn't open in this process, so the host can bring that session back online as its owner before the wake runs. If no session owns the thread afterwards, or the hook throws, the delivery fails with that error instead of waking with no user.

Pair it with `prepareWakeRequestContext`, which attaches the owner's identity to the wake itself:

```ts
const code = await createMastraCode({
  resumeWakeSession: async ({ resourceId, threadId }) => {
    const owner = await lookupSessionOwner(resourceId);
    if (!owner) throw new Error(`Session ${resourceId} has no known owner`);
    const requestContext = new RequestContext([['user', owner]]);
    await code.controller.createSession({ id: resourceId, resourceId, ownerId: owner.id, threadId, requestContext });
  },
  prepareWakeRequestContext: async ({ requestContext, resourceId }) => {
    requestContext.set('user', await lookupSessionOwner(resourceId));
  },
});
```
