---
'@mastra/factory': patch
---

Added a sync API so boards can stay current without re-downloading every card.

- `GET /web/factory/projects/:id/work-items/sync` returns the open cards and per-column counts on first call, then only the cards written or deleted since the returned `cursor`. The project's feed-events stream now sends a `board` event after card writes, so boards know when to ask.
- `GET /web/factory/projects/:id/work-items` takes `board`, `stage`, `q`, `source`, `linearProject`, `label`, the person filters `teammate`, `author`, `assignee`, `reviewer` and `worked`, plus `sort` (`recent`, `recent-mine`, `created-newest`, `created-oldest`), `limit` and `cursor`. It returns `nextCursor` when more cards remain. Without any of these it still returns every card.
- New `GET .../work-items/counts` (same filters), `GET .../work-items/sources` (each card's external source, for Intake de-duplication) and `GET .../work-items/:workItemId` (one card, for deep links).
