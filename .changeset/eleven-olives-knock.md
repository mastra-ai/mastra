---
'@mastra/platform-workspace': patch
---

PlatformSandbox restarts use the current sandbox connection after the previous sandbox is deleted or the platform does not return an instance URL, so later commands do not hit a stale sidecar.
