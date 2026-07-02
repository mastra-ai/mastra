---
'@mastra/playground-ui': patch
---

Fixed the Signals page showing empty clusters for every signal except the most recently clustered one. Cluster queries no longer pin the entity-wide latest run id: the API resolves the latest run per signal, and the details page reuses the run resolved by the topics response for its examples and points queries.
