---
'@mastra/factory': patch
---

Improved how an open Factory board stays up to date. The board listing now returns a `cursor`, and `GET /web/factory/projects/:id/work-items?since=<cursor>` answers with only the cards changed and the ids of the cards removed since that read, instead of the whole board.
