---
'@mastra/factory': patch
'@mastra/clickhouse': patch
'@mastra/modal': patch
'@mastra/server': patch
'mastracode': patch
'@mastra/core': patch
---

Fixed an internal reconciliation timestamp (`externalSourceMissingAt`) leaking into work item metadata returned by the Factory API.
