---
'@mastra/core': patch
---

Fixed durable and evented agent streams so completion and cleanup from an earlier execution preserve a newer or resumed run's status, live state, and replay history. Existing durable replay records remain readable after upgrading. Queued events retain their step ownership guard and publication options, including local-only replay exclusion, and registry cleanup handles publisher detachment failures.
