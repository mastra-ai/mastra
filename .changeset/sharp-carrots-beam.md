---
'@mastra/core': minor
'mastracode': patch
---

Added optional threadLock callbacks to HarnessConfig for preventing concurrent thread access across processes. The Harness now calls acquire/release during selectOrCreateThread, createThread, and switchThread when configured. This is a non-breaking addition — locking is opt-in via the new config field.
