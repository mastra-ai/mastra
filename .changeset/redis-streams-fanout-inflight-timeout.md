---
'@mastra/redis-streams': patch
---

Fixed `inFlightTimeoutMs` having no effect on fan-out (ungrouped) subscriptions. The reclaim loop skipped those subscriptions entirely, so a hung handler on one was never nacked and recovered. The sibling-claim scan is still skipped for fan-out subscriptions (they have no siblings), but the in-flight timeout pass now runs for them when `inFlightTimeoutMs` is set.
