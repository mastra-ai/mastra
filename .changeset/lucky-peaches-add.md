---
'@mastra/core': patch
'@mastra/code-sdk': patch
---

Added optional `warmup()` method to `SkillSource` interface for coalescing sandbox network warmup probes. When provided, `WorkspaceSkillsImpl` calls it once before fanning out parallel skill discovery, avoiding N redundant transport failures when loading skills from a cold sandbox.

`SandboxFilesystem` now implements `warmup()` with a cheap `true` exec that exercises the transport layer before parallel skill loads begin.
