---
'@mastra/evals': patch
---

Fixed the textual difference scorer running out of memory on long texts. Two 30,000-character texts used to crash the process. Scores stay the same.
