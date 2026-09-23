---
'@mastra/duckdb': minor
'@mastra/pg': minor
'@mastra/clickhouse': minor
---

Added portable nested scalar metadata predicates and discovery to advanced trace queries across trace, span, score, and feedback scopes. Metadata paths are compiled from trusted segment tuples with parameterized extraction, exact string, number, and boolean semantics, object-only traversal, and bounded field and value discovery.
