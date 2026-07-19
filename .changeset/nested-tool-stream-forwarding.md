---
"@mastra/core": patch
---

Nested agents and workflow-as-tools now stream progressive updates to clients as chunks arrive instead of buffering until completion, so clients can receive and map nested output consistently.
