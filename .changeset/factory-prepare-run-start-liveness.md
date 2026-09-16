---
'@mastra/factory': patch
---

Fix `prepareRunStart` replaying a dead run binding after abort recovery. When a stage was re-entered following an abort, the replay guard matched the prior pending-start row by kickoff key alone and returned its original (already revoked) binding, so the re-entry re-bound the dead session and never used the freshly minted one. The replay branch now honors a pending-start row only when its binding is still active; a revoked or missing binding is discarded so a fresh binding is minted instead.
