---
'@mastra/factory': patch
---

Factory sessions that push commits to an existing pull request now follow it. A thread hears when the pull request merges or closes even if another session opened it. Pushes that create a new branch, or that target a repository outside the Factory environment, subscribe nothing.
