---
'@mastra/factory': patch
---

Added paging, filters and sort to the work-items list, so a board can load the cards it shows instead of every card in the project. `GET /web/factory/projects/:id/work-items` now takes `board`, `stage`, `q`, `sort` (`recent`, `recent-mine`, `created-newest`, `created-oldest`), `limit` and `cursor`, and returns `nextCursor` when there are more cards. Without any of them it still returns every card. Also added `GET .../work-items/counts` (cards per board and column), `GET .../work-items/sources` (each card's external source, for intake de-duplication) and `GET .../work-items/:workItemId` (one card, for deep links).
