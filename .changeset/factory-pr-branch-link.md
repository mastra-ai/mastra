---
'@mastra/factory': patch
---

Factory now links a pull request to the Work card it came from by the card's own branch name, even when no session on the card checked that branch out. The card shows the open PR, and when the PR merges the card moves to Done without a manual move. A trusted author's pull request joins that card. Moving a card that has no pull request to PR review now explains that it enters PR review once one is attached.
