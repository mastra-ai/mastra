---
'@mastra/core': patch
---

Added consumer group support to UnixSocketPubSub. Named groups now deliver each message once per group with round-robin selection among group members, matching the subscribe group contract that BackgroundTaskManager already relies on. Ungrouped subscriptions keep fan-out behavior, reconnects preserve group membership, and locally delivered messages support bounded nack retry.
