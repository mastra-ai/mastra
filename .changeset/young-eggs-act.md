---
'@mastra/evals': patch
---

Fixed the tone scorer so a last sentence with no final punctuation counts toward the stability score. It was skipped before, so the same reply could get a very different score with and without a final period. A one- or two-word ending, such as `Thanks` or `Positive`, is still not counted.
