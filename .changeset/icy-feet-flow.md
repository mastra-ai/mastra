---
'@mastra/playground-ui': patch
---

Fixed long unbreakable text in Notice, such as a git remote URL with an embedded token, spilling outside the notice box. Messages now wrap at any character and long titles truncate.
