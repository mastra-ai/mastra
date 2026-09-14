---
'@mastra/server': patch
---

Fixed invalid pagination query parameters on the scores, datasets, and background-tasks endpoints returning a 500 instead of a 400.

`GET /api/scores/run/:runId`, `GET /api/scores/scorer/:scorerId`, `GET /api/scores/entity/:entityType/:entityId`, `GET /api/datasets`, `GET /api/datasets/:datasetId/items`, `GET /api/datasets/:datasetId/versions`, `GET /api/datasets/:datasetId/experiments/:experimentId/results`, and `GET /api/background-tasks` still declared `page` and `perPage` as bare numbers, so `?perPage=2.5` or `?page=-1` passed request validation and only failed later in storage as `500 Internal Server Error`. They now use the shared pagination schema and return `400 Bad Request` naming the offending field, like every other paginated endpoint since #21013. Follow-up to #23751.
