---
'@mastra/platform-workspace': patch
---

PlatformSandbox now clears sidecar probe state when the upstream sandbox is destroyed or no instance URL is returned, so a later start does not reuse a stale probe target.
