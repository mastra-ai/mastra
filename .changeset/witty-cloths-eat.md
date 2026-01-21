---
'@mastra/redis': minor
---

Add Redis storage provider

Introduces `@mastra/redis`, a Redis-backed storage implementation for Mastra built on the official `redis` (node-redis) client.

Includes support for the core storage domains (memory, workflows, scores) and multiple connection options: `connectionString`, `host`/`port`/`db`/`password`, or injecting a pre-configured client for advanced setups (e.g. custom socket/retry settings, Sentinel/Cluster via custom client).
