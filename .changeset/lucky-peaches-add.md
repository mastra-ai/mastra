---
'@mastra/core': patch
---

Added optional `warmup()` method to `SkillSource` interface. When provided, `WorkspaceSkillsImpl` calls it once before fanning out parallel skill discovery. This coalesces sandbox network warmup probes into a single operation, avoiding N redundant transport failures when loading skills from a cold sandbox.
