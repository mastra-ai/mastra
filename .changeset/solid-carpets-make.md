---
'@mastra/core': patch
---

Fixed `LocalSandbox` seeding a working directory with a mix of two checkpoint versions when `snapshot()` replaced the checkpoint during `start()`. The seed now retries until it copies one complete checkpoint.
