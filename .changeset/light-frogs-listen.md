---
'@mastra/code-sdk': patch
---

Thread lock files are now created exclusively and supersede stale locks by generation, so two simultaneous launches cannot both claim the same thread and a stale lock can no longer be deleted out from under a live owner. (#21243)
