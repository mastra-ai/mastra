---
'@mastra/server': patch
---

Fixed `PATCH /datasets/:datasetId/experiments/:experimentId/results/:resultId` so it checks that the experiment belongs to the dataset in the path. Before, a caller allowed on one dataset could edit result tags, status, and comments on any other dataset's experiment. It now returns 404 when they don't match.
