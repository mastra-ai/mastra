---
'@mastra/memory': patch
---

Fixed Observational Memory discarding observations that contain one very long line, such as a progress bar or a minified payload. The degenerate-output check now runs on line-sanitized text, so line length alone no longer rejects a faithful summary (#24354).
