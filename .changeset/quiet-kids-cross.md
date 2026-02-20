---
'@mastra/core': minor
---

Added `Workspace.getInstructions()` method that is mount-state-aware — classifies each mount path as sandbox-accessible or workspace-only based on actual mount state. Added `WorkspaceInstructionsProcessor` that automatically injects workspace environment instructions into the agent system message, replacing the previous approach of embedding path context in tool descriptions. Added `instructions` option to `LocalFilesystem` and `LocalSandbox` to override auto-generated instructions. Deprecated `getPathContext()` in favor of `getInstructions()`.
