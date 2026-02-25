---
'@mastra/core': patch
---

Fixed glob pattern resolution for autoIndexPaths and skills to use a unified resolver. Single file paths (e.g. '/docs/faq.md'), directory-matching globs (e.g. '**/content'), and file-targeting globs (e.g. '**/SKILL.md') now work consistently across both autoIndexPaths and skills config. Trailing slashes on paths are also handled correctly.
