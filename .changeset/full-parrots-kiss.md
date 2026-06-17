---
'mastracode': patch
---

Fixed mastracode silently writing all tracing/observability data to the main libsql database even when /observability was never configured. The MastraStorageExporter now only activates when local DuckDB tracing is explicitly enabled via `/observability local on`, preventing the mastra_ai_spans table from growing to tens or hundreds of gigabytes.
