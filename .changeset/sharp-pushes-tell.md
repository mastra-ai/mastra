---
'@mastra/factory': patch
---

`source_control_push_branch` now reports what it pushed. The result includes the pushed `commit`, plus `upToDate: true` when the remote already had that commit and nothing new was sent. Agents can tell a push that landed from a no-op, for example when they push before their commit exists.
