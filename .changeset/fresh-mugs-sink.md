---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground-ui': minor
'@mastra/libsql': patch
'@mastra/pg': patch
---

Added scorer delivery health visibility and segmented score analytics in Studio. The Evaluation page now includes a segmented scores card with time bucketing and group-by over scorer, entity, or any score metadata key, and each scorer's detail panel shows delivery health counters (triggered vs sampled vs saved vs failed) so missing or failed async scores are detectable via `GET /api/scores/scorers/:scorerId/health`.
