---
'@mastra/factory': patch
---

Board transitions and linked work item cards now apply while agent runs occupy every dispatch slot. Previously, closing an issue or opening a PR while `MASTRACODE_DISPATCH_MAX_IN_FLIGHT` runs were active left the card's stage stale until a run finished. Bookkeeping decisions now use their own small dispatch pool, so the board keeps mirroring GitHub while agents work.
