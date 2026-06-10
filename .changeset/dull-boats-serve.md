---
'@mastra/server': minor
'@mastra/observability': patch
'@mastra/core': patch
---

Added tool replay support to the experiment trigger API. `POST /datasets/:datasetId/experiments` now accepts a `toolReplay` option (`fromExperimentId`, `onMiss`) so experiments triggered over HTTP can replay recorded tool outputs instead of executing live tools. Requests combining `toolReplay` with a non-agent target are rejected with a validation error at the API boundary instead of failing the experiment in the background.
