---
'@mastra/core': patch
---

Fixed workspace search reporting the wrong `lineRange` when a custom tokenizer preserves case. Highlighting now uses the same tokens as retrieval, so searching `Python` points at the line containing `Python` rather than a line containing `python`.
