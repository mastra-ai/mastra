---
'@mastra/server': patch
---

Restrict connecting and disconnecting channel bots (e.g. Slack) to the agent's owner. Previously any authenticated caller could attach or detach a channel from any agent via `POST /api/channels/:platform/connect` and `POST /api/channels/:platform/:agentId/disconnect`. The server now enforces the same per-agent ownership rules used for editing or deleting the stored agent (owner, admin bypass via `agents:*` / `agents:admin`, or scoped `agents:edit:<id>`). Code-defined agents (with no stored ownership record) are unaffected.
