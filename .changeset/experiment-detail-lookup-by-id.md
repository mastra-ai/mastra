---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/react': patch
'@internal/playground': patch
---

Fixed the Studio experiment page showing "Experiment not found" for experiments older than the 10 most recent. The page now looks up the experiment directly with the new `GET /experiments/:experimentId` route (`client.getExperiment()` / `useExperiment()`), which returns the experiment with its `datasetId`, instead of searching the first page of the experiments list. Fixes #26477.
