---
'@mastra/server': minor
'@mastra/core': patch
---

Connecting or disconnecting an agent through a channel (e.g. Slack) now requires the same write permission as editing the underlying stored agent. The check runs on `POST /channels/:platform/connect` and `POST /channels/:platform/:agentId/disconnect` whenever the target agent has a record in the stored-agents store. Callers without write access receive a `404 Not found`, matching the behavior of the stored-agent edit routes. Agents defined in code (no stored-agents record) are unaffected and continue to honor only the route's existing auth requirement.

The caller must either own the stored agent, have admin bypass, or hold `agents:edit` (or a scoped `agents:edit:<agentId>`).

```http
POST /channels/slack/connect
Authorization: Bearer <token-with-agents:edit>
Content-Type: application/json

{ "agentId": "support-bot" }
```

```http
POST /channels/slack/support-bot/disconnect
Authorization: Bearer <token-with-agents:edit>
```

`@mastra/core` is bumped as a patch to ship the regenerated permission definitions that back this check.
