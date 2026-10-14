---
'mastra': patch
---

The Factory Slack connection settings page no longer shows the "Create work items for new Slack threads" toggle, and the Factory API commands no longer accept `slackWorkItemsEnabled` on project updates.

Before:

```http
PATCH /web/factory/projects/:id
{ "slackWorkItemsEnabled": true }
```

After: sent alone, the field is rejected as an empty update. Sent with other fields, it is ignored:

```http
PATCH /web/factory/projects/:id
{ "name": "Platform" }
```
