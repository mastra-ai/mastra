---
'@mastra/clickhouse': patch
---

Improved trace deletion with a durable 45-day deletion request and synchronous lightweight delete masking across trace branches, metrics, logs, scores, and feedback. Physical removal follows the deployment's configured retention TTL and merge policy.
