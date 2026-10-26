---
'@mastra/factory': patch
---

Slack thread replies now link the pull requests, issues, commits and Linear tickets they mention instead of leaving bare IDs like `#28467` or `FACT-526`. Every chat-channel run is told to write each reference as a markdown link with the ID as link text, take URLs from tool results or its repositories rather than guessing, and leave a reference unlinked only when it can't find the URL.
