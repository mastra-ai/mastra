---
"@mastra/core": minor
---

Add `idleTimeoutMs` passthrough from `stream()` and `generate()` methods to `createDurableAgentStream()`, enabling auto-termination for crashed producers. This matches the behavior in `observe()` and prevents streams from hanging indefinitely when the producing process crashes.
