---
'@mastra/core': patch
---

Fixed restart() and timeTravel() losing the lifecycle ownership claim on fenced workflow storage. Both operations mint a fresh executionGeneration but previously wrote it unconditionally, so stores that guard the row's lifetime discriminator rejected the write and the run executed unowned steps that were then dropped as stale. They now compare-and-set on the stored status, generation, and resume attempt and throw WORKFLOW_RESTART_NOT_CLAIMED when another generation wins, so a losing caller stands down instead of resolving canceled over a live row.
