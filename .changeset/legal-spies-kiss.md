---
'@mastra/factory': patch
---

Fixed slow Linear boards in Factory. Opening a board no longer creates cards while the page loads.

New Linear issues in sources bound to a project now get their card from the background Linear sweep, within its interval (5 minutes by default), even when nobody has the board open.
