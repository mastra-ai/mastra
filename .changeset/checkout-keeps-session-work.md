---
'@mastra/factory': patch
---

Re-opening a workspace no longer fails when the session's agent switched branches and left uncommitted work in the tree. Git refuses to switch back over those files; the workspace now keeps the checkout on its current branch instead of returning an error — the session's work in progress always wins over the recorded branch.
