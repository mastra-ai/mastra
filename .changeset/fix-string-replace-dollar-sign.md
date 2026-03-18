---
'@mastra/core': patch
---

Fixed `replaceString` utility to properly escape `$` characters in replacement strings. Previously, patterns like `$&` in the replacement text would be interpreted as regex backreferences instead of literal text.
