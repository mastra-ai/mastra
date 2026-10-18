---
'@mastra/core': patch
---

Removed the `gray-matter` dependency. SKILL.md frontmatter is now parsed with the `yaml` package directly, which drops the vulnerable `sprintf-js` package (GHSA-hp3w-g68c-fv3c, no patched release available) from the production dependency tree. YAML frontmatter that worked before keeps working; JavaScript frontmatter (`---js`) is still rejected.
