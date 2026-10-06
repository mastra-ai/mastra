---
'@mastra/core': patch
'@mastra/server': patch
---

Enforced configured FGA permissions for internal agent memory and Agent Controller operations, including actor and acting-agent attribution. Agent Controller routes that create, resume, stream, or retrieve session state now require execute permission because they use get-or-create session resolution; existing read-only FGA roles must be granted `agent-controller:execute` to continue using those routes. Applications without an FGA provider are unchanged.
