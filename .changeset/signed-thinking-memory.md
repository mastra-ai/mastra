---
'@mastra/core': patch
---

**Fixed** legacy Anthropic history that contains a thinking signature without its original thinking text is sanitized before replay, preventing invalid empty signed thinking blocks from being forwarded.

Fixes #17457.
