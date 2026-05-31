---
'@mastra/playground-ui': patch
---

Fixed syntax highlighting in Studio code blocks. Shiki tokens now render with per-token colors (keywords, strings, identifiers) instead of flat monochrome text, and Code Mode `execute_typescript` programs display as a formatted, highlighted TypeScript block instead of a one-line JSON string.
