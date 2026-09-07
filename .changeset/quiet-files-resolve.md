---
'mastra': patch
---

Skip directories and invalid paths during CLI entry discovery so a later valid source file can be selected, while preserving file symlink support and existing missing-entry behavior.
