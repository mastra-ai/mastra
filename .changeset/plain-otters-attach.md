---
'@mastra/platform-workspace': patch
---

Fix platform sandbox reattach: the workspace proxy assigns its own sandbox id on create (the advisory id in the request body is not honored), but `getInfo()` never exposed it, so callers persisting a reattach id (e.g. the Factory sandbox fleet, which reads `metadata.sandboxId`) stored the locally generated construction id instead. Every reattach then 404'd and each session open provisioned a brand-new sandbox and re-cloned the repository. `getInfo()` now reports the platform-assigned id in `metadata.sandboxId`, and `start()` treats a sandbox record with `destroyedAt` set as gone (falls through to a fresh provision) instead of pointing exec at a dead resource.
