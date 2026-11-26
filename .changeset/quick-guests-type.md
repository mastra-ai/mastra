---
'@mastra/rag': patch
---

Fix sentence chunking boundaries after numbers and question/exclamation punctuation, and for Unicode or configured no-whitespace sentence enders. Keep colon-introduced inline numbered lists and Unicode initials (e.g. `И.`) intact, while preserving abbreviations and numbered-list markers.
