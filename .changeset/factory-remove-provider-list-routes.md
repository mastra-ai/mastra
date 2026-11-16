---
'mastra': patch
---

Removed Factory server routes that nothing calls anymore. The board and search stopped reading provider issue and pull request lists, so `GET /web/github/projects/:id/issues`, `GET /web/github/projects/:id/prs`, `GET /web/gitlab/issues`, `GET /web/gitlab/projects/:id/prs`, `GET /web/linear/issues`, `GET /web/jira/issues` and `GET /web/incidentio/issues` are gone. Also removed the unused `GET /web/github/projects/:id/commits` and the legacy `GET`/`POST /web/github/projects/:id/settings` (use `/web/source-control/projects/:id/settings`). Single issue and pull request routes, webhooks, sign-in and session routes are unchanged.
