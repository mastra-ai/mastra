---
'@mastra/factory': patch
---

Fixed Review cards for pull requests that Factory discovers by polling GitHub, instead of through a webhook. These cards now record the pull request author. Previously the author was missing, so the reviewer refused to publish its verdict because it could not match the card to the pull request. Factory also now recognises pull requests it opened itself from their author, and polled cards include the pull request's labels from the start.
