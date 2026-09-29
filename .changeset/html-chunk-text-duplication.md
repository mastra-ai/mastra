---
'@mastra/rag': patch
---

Fixed `strategy: 'html'` chunking repeating the text of nested elements. Each piece of text now appears once, with block elements separated by a space, so chunk text (and anything embedded from it) no longer contains duplicated content.
