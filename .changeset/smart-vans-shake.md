---
'@mastra/core': patch
---

Fixed an internal Mastra instance leaking a scorer hook onto a shared, process-wide emitter. Agents that use a Workspace (or any unwired agent run) built a throwaway internal Mastra whose scorer hook was never removed, so it kept firing on every scorer run and flooded logs with "scorer not found" errors. The scorer still ran correctly on the real Mastra — the noise came from the orphaned handler, which is now released on teardown.
