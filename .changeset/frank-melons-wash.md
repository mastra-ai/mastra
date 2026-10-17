---
'@mastra/playground-ui': minor
---

Added **Group by** to the Traces page filter bar. It summarizes the filtered traces by up to two of entity, status, environment, and entity type, with trace count, error rate, p50 and p95 duration, tokens, and cost per group. While grouped, group filters such as **Group error rate (%)** keep only the groups that match. Choose more columns, such as error count, p99 duration, cached tokens, or distinct users, from the **Columns** menu. Sort by any column, and select a row to filter the trace list to that group. Group by is offered only when the observability store supports trace aggregation. Traces without an entity name, such as scorer runs, are grouped by their entity ID when the store supports it.
