---
'@mastra/valkey-streams': patch
---

Fix the consumer-group reclaim loop so idle pending entries are handed to a sibling consumer instead of back to the consumer that is stuck on them.

Previously each subscription ran `XAUTOCLAIM` with its own consumer name, so a consumer that had read an entry but never acked it would reclaim that entry back to itself on every tick. That reset the entry's idle clock, and a live sibling in the same group never got a chance to claim it. The loop now pages through idle pending entries with `XPENDING … IDLE`, skips the ones it already owns, and claims the rest with `XCLAIM`. `unsubscribe()` also waits for an in-flight reclaim before tearing down the subscription.

Note that with cross-consumer redelivery now working, a handler that legitimately runs longer than `reclaimIdleMs` (default 60 s) without acking will be claimed and re-run by a sibling. Raise `reclaimIdleMs` above your slowest handler if that is not acceptable.
