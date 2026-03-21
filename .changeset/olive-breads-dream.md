---
'@mastra/core': patch
---

Improved skills discovery performance by parallelizing filesystem I/O operations. Discovery of multiple skills, subdirectory scanning, reference file reads, and staleness checks now run concurrently instead of sequentially. Also fixed a bug in CompositeVersionedSkillSource where the root directory stat always returned the current time, causing unnecessary re-discovery on every refresh cycle.
