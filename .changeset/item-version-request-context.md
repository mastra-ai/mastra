---
'@mastra/server': patch
'@mastra/client-js': patch
---

Include `requestContext` in dataset item version history responses (`GET /api/datasets/:datasetId/items/:itemId/versions` and the single version endpoint). The field was stored but stripped from the response, so it could not be compared between versions.
