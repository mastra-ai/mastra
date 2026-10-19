---
'@mastra/factory': patch
---

Fix session branch pushes that left out commits made on another branch. Pushes now include those commits and preserve uncommitted work. Branches that already contain the current work still push without changing the checkout. Factory refuses a push if the session branch has diverged from the current work, or if updating it would affect another worktree.
