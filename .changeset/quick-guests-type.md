---
'@mastra/rag': patch
---

Fix sentence chunking boundaries after numbers and question/exclamation punctuation, and for Unicode or configured no-whitespace sentence enders. Keep Unicode initials (e.g. `И.`) and tight colon-introduced numbered lists intact, while preserving abbreviations and numbered-list markers without depending on the number's value.
