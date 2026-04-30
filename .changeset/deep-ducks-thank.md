---
'mastra': patch
---

Updated the `mastra init` template to use the new `@mastra/localdev` storage package. New projects now generate a single `storage: new LocalDevStore()` line instead of composing LibSQL and DuckDB by hand. The CLI now installs `@mastra/localdev` (which depends on `@mastra/libsql` and `@mastra/duckdb`) instead of installing those packages individually.
