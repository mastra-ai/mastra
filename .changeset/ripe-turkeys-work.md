---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed internal Agent Controller operations so configured authorization providers enforce read and execute permissions. Routes that create, resume, stream, or retrieve session state now require execute permission because they use get-or-create session resolution; existing read-only roles must be granted `agent-controller:execute` to continue using those routes. Applications without an authorization provider are unchanged.
