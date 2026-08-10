---
'@mastra/core': patch
---

Fixed RegexFilterProcessor redact strategy to redact matches split across stream chunks, and added a `streamCarryoverSize` option for custom rules whose matches can be longer than the default 128-char window. Fixes #21049
