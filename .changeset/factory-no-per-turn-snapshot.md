---
'@mastra/factory': minor
'@mastra/platform-workspace': patch
---

Removed the automatic sandbox snapshot Factory took after every agent turn.

`PlatformSandbox.destroy()` on E2B now only kills the sandbox instead of first asking the platform to delete a recovery checkpoint.
