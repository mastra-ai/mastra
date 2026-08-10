---
'@mastra/core': patch
---

Fixed deferred notifications accumulating dead workflow records forever. The internal dispatcher runs on a schedule (every minute by default) and left a completed snapshot row behind on every run, so `mastra_workflow_snapshot` grew unboundedly — tens of thousands of rows that were never read again. These runs no longer persist snapshots. Fixes #20254
