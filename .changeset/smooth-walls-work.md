---
'@mastra/clickhouse': patch
---

Fixed DEFAULT constraint for thread metadata column when using JSONB type.

**What changed:** The DEFAULT '{}' constraint is now properly applied to the metadata column for both 'text' and 'jsonb' column types. Previously, the constraint was only applied when the schema specified 'text', causing new ClickHouse installations with 'jsonb' metadata columns to lack database-level protection against empty strings.

**Impact:** While the application-level `parseMetadata()` function already handles empty strings gracefully (added in beta.0), this fix provides defense-in-depth by ensuring the database itself defaults to '{}' for new table installations. Existing tables and older versions are unaffected.

Related to #11882
