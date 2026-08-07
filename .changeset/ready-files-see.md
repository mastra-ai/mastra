---
'@mastra/platform-workspace': patch
---

Improved `PlatformSandbox.getInfo()` to return cached sandbox information when the sandbox is known to be directly reachable, removing a redundant network round-trip on every workspace status poll. When no cached address is available, `getInfo()` behaves exactly as before.
