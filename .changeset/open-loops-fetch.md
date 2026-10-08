---
'@mastra/clickhouse': patch
---

Fixed trace queries and trace aggregates dropping a trace when another tenant stored a trace with the same trace ID. Scoped trace queries and aggregates now read only that tenant's trace roots when picking each trace's current root.
