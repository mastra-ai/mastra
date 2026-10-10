---
'@mastra/core': patch
'@mastra/opensearch': patch
'@mastra/evals': patch
---

Exported `ServerConfig` from `@mastra/core/server` and `OPENSEARCH_PROMPT` from `@mastra/opensearch` so the documented imports resolve. Fixed JSDoc import paths in `@mastra/evals` to use `@mastra/evals/scorers/prebuilt` and `@mastra/evals/scorers/utils`.
