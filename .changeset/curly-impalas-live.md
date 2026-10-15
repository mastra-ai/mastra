---
'@mastra/factory': minor
'@mastra/code-sdk': patch
---

Moved the thinking level default onto each Factory. Organization admins set it under Settings → Models → Factory defaults, and every session and work-item run in that Factory uses it until it picks its own level. Every Factory, including existing ones, starts at off after upgrading.

**Why:** the old default lived in the server's settings.json, so one value was shared by every Factory on the server, and with sign-in turned on it could only be changed after setting `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID`.

**Removed:** the `GET /web/config/thinking` and `PUT /web/config/thinking` routes and the `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID` variable. Set the level with `PATCH /web/factory/projects/:id` and `{ "defaultThinkingLevel": "high" }` instead. A level saved in settings.json (global or per mode) is no longer read by Factory sessions, so if you set one there, set it again on each Factory under Settings → Models → Factory defaults.
