---
'@mastra/factory': minor
'@mastra/code-sdk': patch
---

Moved the thinking level default onto each Factory. Organization admins set it under Settings → Models → Factory defaults, and every session and work-item run in that Factory uses it until it picks its own level. New Factories start at off.

**Why:** the old default lived in the server's settings.json, so one value was shared by every Factory on the server, and with sign-in turned on it could only be changed after setting `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID`.

**Removed:** the `GET /web/config/thinking` and `PUT /web/config/thinking` routes and the `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID` variable. Set the level with `PATCH /web/factory/projects/:id` and `{ "defaultThinkingLevel": "high" }` instead. A server-wide level saved in settings.json is no longer read by Factory sessions.
