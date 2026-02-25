---
'@mastra/core': patch
---

Fixed path matching for auto-indexing and skills discovery.
Single file paths, directory globs, and `SKILL.md` file globs now resolve consistently.
Trailing slashes are now handled correctly.
