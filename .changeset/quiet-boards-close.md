---
'@mastra/factory': minor
---

Board loads no longer ship every done and canceled card. `GET /web/factory/projects/:id/work-items` now returns open cards plus a per-phase summary of closed ones (`excludedCards`: count, source keys for intake de-duplication, and recent created/closed times for activity), and `?threadId=` returns the cards bound to a thread whatever their phase. Done and canceled columns read their cards in pages from the new `GET /web/factory/projects/:id/work-items/terminal?board=&stage=&offset=&limit=`.
