---
'mastracode': minor
'@mastra/core': minor
---

Added `/debug-chat-export` slash command that dumps the active thread, every message in it, the current observational memory record, and prior OM generations to a timestamped directory under the mastracode app data dir. The export also captures the running mastracode version, observer/reflector models, and thresholds so the dump is enough to reproduce surprising OM behavior (e.g. unexpected reflections or skewed token counts) in a bug report.

Also exposes a new `Harness.getObservationalMemoryHistory()` helper that returns previous generations of the current thread's OM record (newest first), parallel to the existing `getObservationalMemoryRecord()`.
