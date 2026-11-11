---
'@mastra/factory': patch
---

Fixed slow Linear boards in Factory. Opening a board no longer creates cards while the page loads; new Linear issues in sources bound to a project now get their card from the background Linear sweep, so they are filed even when nobody has the board open.
