---
'@mastra/core': patch
---

Fixed `Agent.observe()` replays showing a later state of a run than the one the caller saw live. After a tool approval and resume, a replayed `step-finish` could list steps that only happened after it was emitted. Each stream event is now a copy taken when it is published, so replays from the in-memory cache and Redis match the live stream.
