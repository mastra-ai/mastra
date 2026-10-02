---
'@mastra/factory': patch
---

Fixed Review cards for pull requests that Factory discovers by polling GitHub, instead of through a webhook. These cards now record the pull request author. Previously the author was missing, so the reviewer refused to publish its verdict because it could not match the card to the pull request.
