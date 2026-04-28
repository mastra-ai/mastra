---
'@mastra/server': patch
---

Users with `agents:execute` permission can now run stored agents (generate, stream, approve tool calls) without needing the broader `agents:read` grant. Public stored agents remain executable by any authenticated user.
