---
'@mastra/evals': patch
---

Fixed faithfulness and hallucination scorers returning inflated scores when the judge model returned fewer verdicts than extracted claims. Scores are now divided by the number of claims, so claims without a verdict are no longer silently dropped. Verdicts are also matched case-insensitively, so `"Yes"` is counted the same as `"yes"`.
