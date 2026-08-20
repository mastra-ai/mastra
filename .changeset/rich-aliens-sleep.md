---
'@mastra/factory': patch
---

Fixed the Factory board and session sidebar reshuffling while you read them. Cards and sessions are now ordered by when they were created, not by when they were last touched. A background sync or an agent run no longer moves a card. In the sidebar, a session whose pull request is merged or closed now sits below the ones still open, unless its agent is still working or left output you have not read.
