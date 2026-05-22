---
'@mastra/core': patch
---

Fixed thread subscription streams stalling or deadlocking when multiple consumers observe the same active run. Thread streams are now multicast to subscribers so each subscriber receives the run without competing for the underlying stream, and follow-up messages can continue while a subscription is active.
