---
'@mastra/memory': patch
'@mastra/pg': patch
---

feat(pg): add flexible PostgreSQL configuration with shared types

- Add support for multiple connection methods: connectionString, host/port/database, and Cloud SQL
- Introduce shared PostgresConfig type with generic SSL support (ISSLConfig for pg-promise, ConnectionOptions for pg)
- Add pgPoolOptions support to PgVector for advanced pool configuration
- Create shared validation helpers to reduce code duplication
- Maintain backward compatibility with existing configurations