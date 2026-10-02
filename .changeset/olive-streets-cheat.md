---
'@mastra/core': patch
---

Fixed skill publishing so it rejects JavaScript frontmatter (`---js`) in `SKILL.md` instead of running it. Publishing now parses `SKILL.md` the same way as loading and validating a skill. Fixes [#25551](https://github.com/mastra-ai/mastra/issues/25551).
