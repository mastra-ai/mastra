---
'mastra': patch
---

`mastra api factory intake-route list` now returns `canEdit`, which says whether you may change the project's routes, and `intake-route create` puts a route that places new cards ahead of the first route that takes every new card (by default "Everything else"), so it can match. Route conditions also accept the new `source.repository`, `source.provider`, `item.key`, `item.state` and `item.assignees` fields:

```bash
mastra api factory intake-route create "$PROJECT_ID" '{"name":"acme/docs goes to Docs","when":{"operator":"AND","conditions":[{"field":"source.repository","operator":"equals","value":"acme/docs"}]},"target":{"boardKey":"docs"}}'
```
