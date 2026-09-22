---
'@mastra/clickhouse': patch
---

Fixed rewritten observability scores so ordinary reads and trace predicates use compact current state and consistently return the latest sequentially written value for each score ID. Overlapping concurrent rewrites of one score ID have an undefined winner.
