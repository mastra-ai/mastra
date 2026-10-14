---
'@mastra/deployer': patch
---

Fixed `mastra build` evaluating JavaScript frontmatter in file-based agents. A `SKILL.md` or markdown schedule starting with `---js` or `---javascript` was passed to gray-matter with default options, which runs `eval()` on the block. These files are now rejected with a clear error instead of executing code on the build machine. YAML frontmatter is unchanged.
