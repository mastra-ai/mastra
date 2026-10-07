---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed internal Agent Controller operations so configured authorization providers enforce read and execute permissions. Read routes now authorize `agent-controller:read` and only return existing live sessions without implicitly creating or rebinding session state; operations that create, resume, or mutate sessions require `agent-controller:execute`. Applications without an authorization provider are unchanged.
