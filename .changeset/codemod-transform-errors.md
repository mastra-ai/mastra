---
'@mastra/codemod': patch
---

Fixed codemod runs reporting success when a transform crashed. Every jscodeshift transformation error (not just syntax errors) is now reported against the correct file, and both individual codemod runs and `v1` exit with a non-zero code when any file fails to transform.
