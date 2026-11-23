---
'@mastra/evals': patch
---

Fixed the tone scorer so a response whose last sentence has no final punctuation is scored in full. The last sentence was skipped before, so the same reply could get a very different stability score with and without a final period.
