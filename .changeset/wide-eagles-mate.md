---
'@mastra/clickhouse': patch
---

Fixed compatibility with the agent version-label table type added by core. ClickHouse builds with the new core contract but does not provide agent version-label persistence.
