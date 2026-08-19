---
'@mastra/factory': patch
---

Factory sessions can start before their sandbox is ready: resolving a session returns its workspace immediately, and background checkpoint-build failures now show up in logs instead of disappearing.
