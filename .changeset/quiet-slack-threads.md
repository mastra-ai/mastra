---
'@mastra/factory': minor
---

Slack threads no longer create Work board cards. A Slack DM or @-mention still starts its session and posts the "New session started" card, whatever the factory's old setting was.

The `slackWorkItemsEnabled` project setting is removed from the project update API.

Before:

```http
PATCH /web/factory/projects/:id
{ "slackWorkItemsEnabled": true }
```

After: sent alone, the field is rejected as an empty update (400, "At least one project field is required"). Sent with other fields, it is ignored:

```http
PATCH /web/factory/projects/:id
{ "name": "Platform" }
```

Slack-thread cards that already exist keep receiving `aside` comments and keep posting feed comments back to Slack.
