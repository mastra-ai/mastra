---
'@mastra/core': patch
---

Fixed workspace tools being callable by their old default names (e.g. mastra_workspace_edit_file) when renamed via tools config. The tool's internal id is now updated to match the remapped name, preventing fallback resolution from bypassing the rename.
