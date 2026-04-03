---
'@mastra/core': patch
---

Fixed skill path resolution when disambiguating same-named skills. The `skill` tool now correctly resolves skills by path when the location includes the `/SKILL.md` suffix. Fixes #14918.
