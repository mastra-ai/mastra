---
'@mastra/factory': patch
---

Fixed slow Jira boards in Factory. Opening a board no longer creates cards while the page loads. New Jira issues of a routed project now get their card from the background sweep (every 5 minutes by default), whether or not anyone has the board open. Setting `MASTRACODE_JIRA_RECONCILE_ENABLED=false` now also stops new Jira issues from getting cards.
