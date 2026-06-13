---
'@mastra/oracledb': minor
---

Add Oracle Database storage and vector providers for Mastra.

This introduces `OracleStore` for durable Mastra storage domains and `OracleVector` for Oracle `VECTOR` backed retrieval, including schema initialization, migration tracking, schema export, shared connection pooling, metadata filtering, and Oracle-specific vector index support.
