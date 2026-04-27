---
'@mastra/server': patch
---

Added Fine-Grained Authorization (FGA) enforcement across server handlers and memory APIs:

- Route-level checks on detail endpoints, custom routes (including path parameters), and resource-scoped search
- Thread-level checks on reads, writes, creation, cloning, message saving, and listing — with unviewable threads hidden from totals and pagination
- Authenticated user context preserved through thread authorization, and the thread's owning `resourceId` forwarded into the FGA context so providers can derive composite tenant-scoped resource IDs
- Typed FGA permission constants accepted in route and thread authorization config
