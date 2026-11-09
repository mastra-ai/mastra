---
'@mastra/core': patch
---

Fixed time travel hanging on evented workflows whose `shouldPersistSnapshot` skips running snapshots, when replaying from a step that comes before a failed `foreach` step.
