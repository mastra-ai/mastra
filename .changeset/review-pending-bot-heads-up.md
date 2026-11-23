---
'@mastra/factory': patch
---

Factory review no longer requests changes just because a review bot or CI check is still pending once the 10-minute wait runs out. The reviewer now forms its verdict from the evidence it collected and notes the missing signal as a non-blocking heads-up. Ordinary CI, build and scan checks are not treated as review bots and are not waited on, so branch protection stays in charge of whether they block a merge.
