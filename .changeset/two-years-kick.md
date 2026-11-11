---
'@mastra/factory': minor
---

Added two read routes that answer what the new session page shows without sending a project's cards.

`GET /web/factory/projects/:id/work-items/starters` counts the cards behind each starter on the project's default board, such as the cards whose run failed, the pull requests awaiting review and the cards not yet triaged.

`GET /web/factory/projects/:id/work-items/activity?since=<instant>` returns how many cards the project has, and when cards were created and completed since that instant. `since` is required and must be an ISO date-time such as `2026-06-01T00:00:00.000Z`.
