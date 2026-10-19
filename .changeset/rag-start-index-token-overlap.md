---
'@mastra/rag': patch
---

Fixed `addStartIndex` returning `startIndex: -1` for every other chunk when chunk overlap is measured in tokens (the `token` strategy, or a custom `lengthFunction`). Every chunk now reports where it starts in the source text.
