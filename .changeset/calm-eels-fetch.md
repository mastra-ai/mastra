---
'@mastra/railway': minor
---

Added a public `sandboxId` getter to `RailwaySandbox` that exposes the physical Railway VM id. Persist it and pass it back via the `sandboxId` option to reattach to the same VM on resume instead of provisioning a replacement.
