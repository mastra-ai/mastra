---
'@mastra/factory': patch
---

Fixed the board's Intake column pulling every open pull request or issue of the repository on its own, behind a spinner, whenever a filter, cards already on the board, or drafts left the loaded pages with little to show.

Reaching the end of the column now loads one page. A page that adds nothing to scroll past leaves the end where it is, so the next page waits for a scroll or the Load more button instead of loading by itself. The Activity, Attention, and Rules lists follow the same rule.
