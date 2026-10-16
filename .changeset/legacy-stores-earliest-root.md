---
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/mssql': patch
'@mastra/mongodb': patch
'@mastra/dsql': patch
'@mastra/oracledb': patch
'@mastra/spanner': patch
---

Stored spans now keep the parent span ID from your outside tracing system (for example OpenTelemetry) as `externalParentSpanId`. When a trace has several top-level runs, `getRootSpan` now returns the earliest one. Before, it returned any one of them, and `@mastra/dsql` threw an error.
