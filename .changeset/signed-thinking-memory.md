---
'@mastra/core': patch
---

**Fixed** Anthropic signed thinking blocks now replay from memory with their original thinking text and signature together. Legacy history that already lost the thinking text is sanitized before Anthropic requests so invalid empty signed thinking blocks are not forwarded.

Fixes #17457.
