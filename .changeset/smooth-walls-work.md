---
'@mastra/clickhouse': patch
---

Fixed ClickHouse metadata handling to prevent empty string crashes when storing undefined metadata.

**What changed:**
- Applied DEFAULT '{}' constraint to metadata columns for both 'text' and 'jsonb' types (previously only 'text')
- Extended `serializeMetadata()` and `parseMetadata()` helpers to resources (previously only threads)
- ClickHouse-specific issue: undefined values become empty strings in String columns, causing JSON.parse() crashes

**Why ClickHouse needs this:**
- ClickHouse has no native JSON type - both 'text' and 'jsonb' map to String columns
- When undefined is stored in String columns, it becomes `''` (empty string)
- On retrieval, `JSON.parse('')` crashes with "Unexpected end of JSON input"

**Impact:**
- Defense-in-depth: database-level DEFAULT '{}' + application-level safe parsing
- Prevents crashes across all ClickHouse storage domains (threads, resources, scorers, spans, agents)

Related to #11882
