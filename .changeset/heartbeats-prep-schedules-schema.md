---
'@mastra/core': minor
'@mastra/libsql': minor
'@mastra/pg': minor
'@mastra/mongodb': minor
'@mastra/server': minor
'@mastra/client-js': minor
'mastra': patch
---

Extend the schedules storage schema to support owned schedules and richer trigger audit. This is a breaking schema change to `mastra_schedules` and `mastra_schedule_triggers`; scheduled workflows are still in alpha so no compat shim is provided.

- `Schedule` gains optional `ownerType` / `ownerId` so a schedule row can be attributed to an owning subsystem (e.g. an agent that owns a heartbeat schedule). Workflow schedules leave both fields unset.
- `ScheduleTrigger.status` is renamed to `outcome` and the type is widened to `ScheduleTriggerOutcome` so future outcome values can be added without another rename.
- `ScheduleTrigger` gains a stable `id` primary key and new `triggerKind`, `parentTriggerId`, and `metadata` fields. `triggerKind` distinguishes `schedule-fire` rows from later `queue-drain` rows (used by upcoming heartbeat work); `parentTriggerId` links related rows; `metadata` carries outcome-specific context.
- The libsql, pg, and mongodb adapters all add the new columns/indexes. Their `@mastra/core` peer dependency is tightened to `>=1.32.0-0 <2.0.0-0` so installing a new storage adapter against an older core (or vice-versa) surfaces a peer-dependency warning at install time instead of silently writing/reading the wrong field.
- Scheduler producer, server schemas/handler, and client SDK types are updated to use the new fields. The `triggers` response on `GET /api/schedules/:id/triggers` now returns `outcome` instead of `status`.
- The bundled Studio (Mastra CLI) is updated to read `outcome` so the schedule detail page keeps polling and rendering publish-failure rows correctly.
