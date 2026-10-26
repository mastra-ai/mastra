---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed spans, logs, metrics, scores and feedback reporting another entity's version. A tool or model call made by a versioned agent no longer reports the agent's version as its own `entityVersionId`, so grouping or filtering by version only counts that version's own entity. A span still reports a version when it was declared for it or inherited from a span of the same entity. Already-stored spans and signals are unchanged. Fixes #28418.
