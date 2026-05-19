---
'@mastra/core': patch
---

Workspace skills now refresh on each skill-tool invocation, so edits to SKILL.md files (or new skills added to the workspace) are picked up between tool calls without restarting the server. Set `checkSkillFileMtime: true` on the workspace config to also detect content changes to existing SKILL.md files. Fixes [#16640](https://github.com/mastra-ai/mastra/issues/16640).
