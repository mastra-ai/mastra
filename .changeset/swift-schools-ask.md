---
'@mastra/evals': patch
---

Fixed the textual difference scorer so `changes` counts moved words. Texts that differ only in word order reported `changes: 0`, and texts with some moved words reported too few.
