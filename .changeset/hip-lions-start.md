---
'@mastra/core': patch
---

Fixed channel threads created from a tool-approval click bypassing the `resolveResourceId` and `resolveThreadId` hooks. The approval-button handler hardcoded the new thread's owner to `${platform}:${userId}` of whoever clicked, so a thread minted by a click (for example after a storage miss, or a click racing thread creation) was permanently scoped to the wrong owner and per-resource memory silently attached to the wrong user. Both hooks now run on every path that can create a channel thread. Fixes [#20076](https://github.com/mastra-ai/mastra/issues/20076).

**Hook context change**: a button click carries no incoming message, so `ResolveResourceIdContext` and `ResolveThreadIdContext` now expose the triggering user as `actor` (the message author, or the button clicker), and `message` is optional — absent when the thread is created from a click. Hooks that read `message.author` should switch to `actor`:

```ts
// Before
resolveResourceId: async ({ message, defaultResourceId }) =>
  (await lookupSso(message.author.userId)) ?? defaultResourceId,

// After
resolveResourceId: async ({ actor, defaultResourceId }) =>
  (await lookupSso(actor.userId)) ?? defaultResourceId,
```
