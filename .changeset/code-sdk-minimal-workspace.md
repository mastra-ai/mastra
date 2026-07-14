---
"@mastra/code-sdk": minor
---

Simplified the default Mastra Code workspace to a filesystem-only workspace. Surface-specific workspace behavior such as local command execution, LSP, skills, and GitHub/Railway sandbox selection must now be injected by the runtime through `MastraCodeConfig.workspace`.
