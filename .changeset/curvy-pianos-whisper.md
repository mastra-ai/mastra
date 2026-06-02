---
'@mastra/core': patch
---

Fixed `filterMessagesForPersistence` unconditionally trimming whitespace from text parts, which caused spaces between words to be lost when text parts were split by token boundaries in the streaming span-based persistence. The trim now only applies when working memory tags are actually stripped.
