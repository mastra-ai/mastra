---
'@mastra/core': patch
---

Fixed durable and evented agent streams so completion and cleanup from an earlier execution preserve a newer or resumed run's status, live state, and replay history. Existing durable replay records remain readable after upgrading.
