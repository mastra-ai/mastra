---
'@mastra/core': patch
---

Fixed a bug in `LocalSandbox` where loading a custom `seatbeltProfilePath` on macOS would get overwritten in memory with the default generated profile upon mount or unmount lifecycle events.
