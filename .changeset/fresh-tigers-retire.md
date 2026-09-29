---
'@mastra/core': patch
---

**Added atomic cross-process thread ownership handoff**

`agent.claimThreadOwnership()` now accepts `yieldOwnership`, `onOwnershipYielded`, and `onOwnershipLost` callbacks. When another process asks for a thread and `yieldOwnership` returns `true`, the thread passes to that process in the same request. `onOwnershipYielded` runs after the handoff. Owner lookups for message delivery never call `yieldOwnership`. If another process takes an expired claim first, `onOwnershipLost` runs so the caller can retry.

`UnixSocketPubSub` now coordinates thread ownership between processes that share a socket directory. A running owner restores an expired claim when no other process has taken it. When an owner hands off a thread or exits, another process can take over immediately.

**Before**

```ts
const claim = await agent.claimThreadOwnership({
  resourceId,
  threadId,
})
```

**After**

```ts
let claimActive = true
const claim = await agent.claimThreadOwnership({
  resourceId,
  threadId,
  yieldOwnership: () => session.thread.getId() !== threadId,
  onOwnershipYielded: () => {
    claimActive = false
  },
  onOwnershipLost: () => scheduleClaimRetry(threadId),
})
```
