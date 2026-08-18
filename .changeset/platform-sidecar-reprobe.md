---
'@mastra/platform-workspace': patch
---

PlatformSandbox now restarts a timed-out sidecar health probe on the next command instead of falling back to the slower lease-based exec path for the sandbox's lifetime. If the in-sandbox sidecar was just slow to boot, later commands recover the fast private-network transport automatically.
