---
'@mastra/core': minor
---

Added a trusted tenant scope to advanced trace queries. Hosts pass `{ organizationId, resourceId? }` to `planTraceQuery`, `planThreadQuery`, and the discovery planners; the scope is carried on the trusted plan, ANDed into every root and related-signal scan by stores, and bound into keyset cursors so a cursor reused under another scope fails with `TRACE_QUERY_CURSOR_CONFLICT` before storage runs. Callers still can't name `organizationId` or `projectId` in predicates. No scope means no filter, so self-hosted behavior is unchanged.
