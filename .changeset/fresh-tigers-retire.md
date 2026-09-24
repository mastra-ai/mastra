---
'@mastra/core': patch
---

**Added atomic cross-process thread ownership handoff**

`agent.claimThreadOwnership()` now accepts `yieldOwnership` and `onOwnershipYielded` callbacks. When another process requests a thread and `yieldOwnership` returns `true`, lease-capable PubSub providers transfer the claim during the current request before acknowledging it. Plain owner lookups used for signal delivery never trigger a yield.

`UnixSocketPubSub` now provides filesystem-backed leases shared by processes using the same socket directory. Lease ownership is fenced by an owner token, PID, and process-incarnation nonce so live owners survive event-loop stalls while dead owners can be reclaimed immediately.

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
})
```
