---
'@mastra/core': patch
---

Fixed `FilesystemStore` version history dropping the commit that restores a deleted entity. When an agent, skill, prompt block, MCP client or server, workspace, or scorer definition was removed from its shared JSON file and later restored with identical content, the restore commit was skipped and never appeared in `listVersions`. Restores are now recorded as their own version, so the version history matches the git history. (https://github.com/mastra-ai/mastra/issues/30421)
