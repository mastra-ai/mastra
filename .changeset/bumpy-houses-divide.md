---
'@mastra/factory': patch
---

Factory sessions can start before their sandbox is ready. Checkpoint-build failures now show up in logs instead of disappearing, invalid dispatcher intervals fail at startup, retrying a project-repository link no longer wipes an existing base checkpoint, and a project-link callback error no longer changes the HTTP response.
