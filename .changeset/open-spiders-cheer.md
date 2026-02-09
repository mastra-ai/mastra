---
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/clickhouse': patch
'@mastra/cloudflare': patch
---

Added prompt block storage implementations for PostgreSQL, LibSQL, and MongoDB. Each store supports full CRUD for prompt blocks and their versions, including JSON serialization for rules and metadata. Also updated agent instructions serialization in PG and LibSQL to support the new AgentInstructionBlock array format alongside plain strings.
