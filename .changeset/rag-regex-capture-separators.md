---
'@mastra/rag': patch
---

Fixed regex separators that contain capture groups. Chunking with `separatorPosition` no longer duplicates or drops text, numbered backreferences such as `(,|;)\1` keep working, and unmatched optional captures no longer crash the `character` strategy.
