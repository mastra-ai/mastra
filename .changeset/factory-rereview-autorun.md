---
'@mastra/factory': patch
---

Pushes to a Factory-authored pull request now start a re-review automatically. Previously, once the review card reached Done, the re-review triggered by a new push waited for approval that was never requested, so someone had to click Re-review by hand. Pull requests from other authors still wait for approval as before.
