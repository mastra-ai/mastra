---
'@mastra/clickhouse': patch
---

Fixed metadata handling across all tables to prevent empty string crashes and ensure consistent behavior.

**What changed:**
- Applied DEFAULT '{}' constraint to metadata columns for both 'text' and 'jsonb' types across all tables (threads, resources, scorers, spans, agents)
- Updated resources to use `serializeMetadata()` and `parseMetadata()` helper functions for safe JSON handling
- Previously, only threads had this protection, while resources used unsafe `JSON.parse()` that could crash on empty strings

**Impact:**
- Provides defense-in-depth with both database-level (DEFAULT constraint) and application-level (helper functions) protection
- All metadata columns now consistently handle null/undefined/empty strings by converting to `{}`
- Prevents potential crashes across all storage domains, not just threads

Related to #11882
