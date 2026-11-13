---
'@mastra/factory': minor
---

Platform Linear now runs on Mastra Connect. `PlatformLinearIntegration` reads every workspace through its project-linked `linear` connection, receives Linear's webhooks as Platform events instead of polling for them, and reconciles hourly.

- Workspaces connected before this change hold their tokens on the platform. Factory moves them onto Mastra Connect on its own, at boot and whenever the hourly check finds one left. Their sources, routing and cards carry over unchanged. Until a workspace has moved, its status reads `migration_required`; there is no fallback to the old platform routes.
- The move covers the whole organization and can't be undone. Factory deployments in the organization that haven't been upgraded lose Linear access until they are.
- **Settings → Work Intake** shows a move in progress, a stalled move and any skipped workspaces. Organization admins can retry it with **Retry now**, or `POST /web/integrations/platform/linear/migrate`.
- On a Platform server, Linear connects in a Mastra Connect window instead of redirecting away from Factory, in Settings, onboarding and the create-Factory wizard. Reconnecting a workspace starts a fresh connection.
- The `platform-linear-events` worker and the `/auth/linear/*` routes are gone from Platform Linear. Self-managed `LinearIntegration` is unchanged.
