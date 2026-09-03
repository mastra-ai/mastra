---
'@mastra/qdrant': patch
'@mastra/lance': patch
---

Fixed the $regex filter test to assert whole-token matching so it passes on all Qdrant versions, including v1.19.1 where unindexed full-text matching became token-aware. Documented that $regex translates to Qdrant's full-text match, which matches whole tokens rather than regular expressions or substrings.
