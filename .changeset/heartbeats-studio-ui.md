---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
'@mastra/playground': minor
---

feat(heartbeats): dedicated HTTP + SDK surface and Studio editing

Adds a dedicated heartbeats HTTP surface that mirrors the public
`agent.setHeartbeat()` / `agent.clearHeartbeat()` / `agent.getHeartbeat()` /
`agent.listHeartbeats()` API so callers never have to reach into schedules
directly:

- `GET /heartbeats` (optional `?agentId=` filter)
- `GET|POST /agents/:agentId/heartbeats`
- `GET|PATCH|DELETE /agents/:agentId/heartbeats/:heartbeatId`
- `POST /agents/:agentId/heartbeats/:heartbeatId/pause`
- `POST /agents/:agentId/heartbeats/:heartbeatId/resume`
- `GET /agents/:agentId/heartbeats/:heartbeatId/triggers`

Responses use a flat `Heartbeat` view model (`agentId`, `threadId`,
`resourceId`, `prompt`, `cron`, `status`, `nextFireAt`, …) so the underlying
schedule + built-in workflow stay an implementation detail.

The Mastra client SDK gains matching methods on `client.getAgent(agentId)`
(`listHeartbeats`, `getHeartbeat`, `createHeartbeat`, `updateHeartbeat`,
`deleteHeartbeat`, `pauseHeartbeat`, `resumeHeartbeat`,
`listHeartbeatTriggers`) plus a global `client.listHeartbeats({ agentId? })`.

Studio is migrated onto the dedicated surface:

- Heartbeats list and detail pages no longer parse schedule rows; they
  consume the flat view model directly.
- Detail page now supports inline editing of `cron` and `prompt`, shows the
  linked thread title when available (linked to the agent chat thread), and
  exposes a confirmable delete action.
- Trigger history replaces the noisy `runId` column with a human-readable
  fire timestamp.
- Internal `__mastra_*` workflows (including `__mastra_heartbeat__`) are
  filtered out of `GET /workflows` and return 404 from
  `GET /workflows/:workflowId`, so the heartbeats implementation no longer
  leaks into the Studio workflows surface.
