---
'@mastra/core': minor
'@mastra/observability': minor
---

Added `requestContext` field to tracing spans. Each span now automatically captures a snapshot of the active `RequestContext`, making request-scoped values like user IDs, tenant IDs, and feature flags available when viewing traces.
