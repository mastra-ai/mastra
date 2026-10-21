---
'@mastra/factory': minor
---

Moved the thinking level default onto each Factory. Organization admins set it under Settings → Models → Factory defaults, and every session and work-item run in that Factory uses it until it picks its own level. Every Factory, including existing ones, starts at medium after upgrading.

**Why:** the old default lived in the server's settings.json, so one value was shared by every Factory on the server, and with sign-in turned on it could only be changed after setting `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID`.

**Removed:** the `GET /web/config/thinking` and `PUT /web/config/thinking` routes and the `MASTRACODE_DEPLOYMENT_ORGANIZATION_ID` variable. Set the level on the Factory instead:

```bash
# Before
curl -X PUT "$FACTORY_URL/web/config/thinking" -H 'Content-Type: application/json' -d '{ "globalDefault": "high" }'

# After
curl -X PATCH "$FACTORY_URL/web/factory/projects/$FACTORY_ID" -H 'Content-Type: application/json' -d '{ "defaultThinkingLevel": "high" }'
```

A level saved in settings.json (global or per mode) is no longer read by Factory sessions, so if you set one there, set it again on each Factory. The per-chat "Chat defaults" row is also gone; a level picked there still overrides the Factory default for the chats that used it, so run `/think default` in those chats to follow the Factory default.
