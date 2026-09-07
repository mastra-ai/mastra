---
'@mastra/factory': patch
---

Fixed the board's Intake column pulling every open pull request or issue of the repository on its own, behind a spinner, whenever a filter, cards already on the board, or drafts left the loaded pages with little to show.

Scrolling to the end of the column still loads the next page. When that page adds nothing to scroll past, the Load more button takes over instead of the next page loading by itself. The Activity, Attention, and Rules lists follow the same rule.
