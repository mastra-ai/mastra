---
'@mastra/factory': patch
---

Fixed workspace re-opening failing when the session's agent switched branches and left uncommitted work in the tree. The workspace now keeps the checkout on its current branch instead of returning an error — the session's work in progress always wins over the recorded branch.
