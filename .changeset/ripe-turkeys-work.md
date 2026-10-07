---
'@mastra/core': patch
'@mastra/server': patch
---

Fixed internal Agent Controller operations so configured authorization providers enforce read and execute permissions. Read routes authorize `agent-controller:read` when inspecting an existing live session. If the in-memory session is missing after a restart, they preserve recovery behavior by recreating it through the `agent-controller:execute`-authorized path. Other operations that create, resume, or mutate sessions also require `agent-controller:execute`. Applications without an authorization provider are unchanged.
