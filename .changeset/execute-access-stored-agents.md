---
'@mastra/server': patch
---

Added an `execute`-level access check for stored agents so users that hold a scoped `agents:execute:<id>` permission can talk to/stream/approve tool calls on a specific agent without needing the broader `agents:read` grant. Execution routes (generate, stream, approve/decline tool call, network) now use the new `assertExecuteAccess` helper, which grants access to owners, admins, public stored agents, and callers holding either `agents:execute[:<id>]` or `agents:read[:<id>]`. Pure read routes (get agent, clone, enhance instructions, get skill) continue to use `assertReadAccess`.
