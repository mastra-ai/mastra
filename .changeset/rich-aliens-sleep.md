---
'@mastra/factory': patch
---

Fixed the Factory board and session sidebar reshuffling on their own. Cards and sessions are now ordered by when they were created instead of when they were last touched, so a background sync or an agent run no longer moves them under you. In the sidebar, a session whose pull request is merged or closed now sits below the ones still open.
