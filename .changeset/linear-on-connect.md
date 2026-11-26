---
'@mastra/factory': minor
---

Platform Linear now runs on Mastra Connect. `PlatformLinearIntegration` reads every workspace through its project-linked `linear` connection, reads Linear's webhooks from each connection's platform event log through the shared Connect event poller, and reconciles hourly.

- Workspaces connected before this change hold their tokens on the platform. Factory moves them onto Mastra Connect on its own, at boot and whenever the hourly check finds one left. Their sources, routing and cards carry over unchanged. Until a workspace has moved, its status reads `migration_required`; there is no fallback to the old platform routes.
- Before upgrading, grant the Factory's Platform credential the `integrations:write` permission; moving a workspace and linking its connection to the project both need it. The move covers the whole organization and can't be undone. Factory deployments in the organization that haven't been upgraded keep serving moved workspaces through the platform's older Linear routes, so deployments can be upgraded in any order.
- Each workspace is moved once and becomes a single Connect connection. A workspace that has already moved is never moved again, even when its connection isn't linked to this Factory's project; the status and diagnostics list it under `migration.notLinked`, and an admin links it in the platform.
- **Settings → Work Intake** shows a move in progress, a stalled move and any skipped workspaces. Organization admins can retry it with **Retry now**, or with a request made as an organization admin:

  ```bash
  curl -X POST "$FACTORY_URL/web/integrations/platform/linear/migrate"
  ```

- A Linear webhook updates only cards that already track its issue, and only in the organization that owns the connection it came through. Where that can't be told (an org-level connection on a deployment serving several organizations), only cards that know the issue's Linear id are updated, never one matched by its identifier alone.
- On a Platform server, Linear connects in a Mastra Connect window instead of redirecting away from Factory, in Settings, onboarding and the create-Factory wizard. Reconnecting a workspace starts a fresh connection.
- The `platform-linear-events` worker and the `/auth/linear/*` routes are gone from Platform Linear. Self-managed `LinearIntegration` is unchanged.
