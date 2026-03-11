---
'@mastra/core': patch
'@mastra/server': patch
---

Experiments now fail immediately with a clear error when triggered on a dataset with zero items, instead of getting stuck in "pending" status forever. The experiment trigger API returns HTTP 400 for empty datasets. Unexpected errors during async experiment setup are now logged and mark the experiment as failed.
