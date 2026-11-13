---
'@mastra/factory': patch
---

Fixed slow Jira and incident.io boards in Factory. Opening a board no longer creates cards while the page loads. New Jira issues and incident.io follow-ups in sources bound to a project now get their card from the background sweep (every 5 minutes by default), whether or not anyone has the board open.
