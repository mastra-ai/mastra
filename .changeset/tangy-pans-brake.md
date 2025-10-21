---
'@mastra/memory': minor
'@mastra/playground': patch
---

Optimize default memory settings for semantic recall based on longmemeval data

- Increased default topk from 2 to 4 for greated accuracy improvement, lowered message range from 2 to 1. This means the defaults will have significantly better accuracy while only increasing the max amount of message in context from 10->12
- Updated playground UI to correctly display the new default values
- These changes only affect users who enable semantic recall without specifying custom values
