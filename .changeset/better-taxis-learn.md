---
'@mastra/elasticsearch': minor
---

Added ElasticSearchStore, an Elasticsearch storage adapter that implements the memory, workflows, and scores storage domains. It shares the same connection config as ElasticSearchVector ({ id, client } or { id, url, auth }), so one Elasticsearch cluster can now power agent memory, workflow snapshots, scores, and semantic recall. See https://github.com/mastra-ai/mastra/issues/21757
