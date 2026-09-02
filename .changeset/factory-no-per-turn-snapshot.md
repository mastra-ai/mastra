---
'@mastra/factory': minor
'@mastra/platform-workspace': patch
---

Factory no longer snapshots the session sandbox after every agent turn, and `PlatformSandbox.destroy()` on E2B only kills the sandbox instead of first trying to delete a recovery checkpoint. Idle E2B sandboxes pause with memory intact and resume on the next request, so the per-turn snapshot only paused the running sandbox to capture state nothing used, and the delete-time checkpoint call was a wasted round trip. Railway sandboxes keep releasing their checkpoint on destroy, and `snapshot()` / `captureCheckpoint()` remain available for callers that want a snapshot on purpose.
