---
'@mastra/factory': minor
---

Added a **Refresh intake** action to the board. Events from the Mastra platform can be lost, so instead of waiting for the hourly reconcile, any member of a project's organization can reconcile its intake sources now: the Platform Jira, incident.io, Linear, Vanta, GitLab and GitHub integrations, and the self-managed GitLab integration, re-read that project's cards, update or close stale ones, and file items that have no card yet. Other organizations' cards are never read or written. A project can be refreshed once a minute per replica. The same refresh is available as `POST /web/factory/projects/:id/intake/refresh`, and custom integrations can take part by implementing `refreshIntake({ orgId, factoryProjectId })`.
