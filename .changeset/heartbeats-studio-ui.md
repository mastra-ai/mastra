---
'@mastra/client-js': minor
'@mastra/playground': minor
---

feat(studio): heartbeats page

Adds a read-only Studio page for browsing agent heartbeats, surfaced under
Primitives in the sidebar (right after Agents). The list view shows agent,
thread, prompt, cron, status, next fire, and last run; the detail view shows
the full heartbeat meta and trigger history.

Also plumbs `ownerType` / `ownerId` query params through
`client.listSchedules()` so the list can filter heartbeat-owned schedules
without pulling all workflow schedules.
