---
'@mastra/factory': minor
---

Board loads no longer ship every done and canceled card. `GET /web/factory/projects/:id/work-items` now returns open cards plus a per-phase summary of closed ones (`excludedCards`: count, source keys for intake de-duplication, and recent created/closed times for activity), and `?threadId=` returns the cards bound to a thread whatever their phase. Done and canceled columns read their cards in pages from the new `GET /web/factory/projects/:id/work-items/terminal?board=&stage=&offset=&limit=`.

Two more reads cover closed cards the board no longer carries: `POST /web/factory/projects/:id/work-items/sessions` returns the cards (any phase, plus their parent and child cards) bound to the given session ids, so the session list keeps each session's status, board and links; `GET /web/factory/projects/:id/work-items/terminal/search?q=` finds done and canceled cards by title or issue number for global search.
