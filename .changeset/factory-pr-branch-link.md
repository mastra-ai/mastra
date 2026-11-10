---
'@mastra/factory': patch
---

Factory now links a pull request to the Work card it came from by the card's own branch name, even when no session on the card checked that branch out. The card shows the open PR, and when the PR merges the card moves to Done without a manual move. Trying to move such a card to PR review now explains that it stays in Review until the PR merges.
