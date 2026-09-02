---
'@mastra/factory': minor
'@mastra/platform-workspace': patch
---

Removed the automatic sandbox snapshot Factory took after every agent turn. Idle E2B sandboxes pause with memory intact and resume on the next request, so the per-turn snapshot only paused the running sandbox for nothing.

`PlatformSandbox.destroy()` on E2B now only kills the sandbox instead of first asking the platform to delete a recovery checkpoint. Railway sandboxes still release their checkpoint on destroy.

`snapshot()` and `captureCheckpoint()` are unchanged for callers that want a checkpoint on purpose.
