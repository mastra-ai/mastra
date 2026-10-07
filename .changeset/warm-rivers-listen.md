---
'@mastra/core': patch
---

Fixed internal agent memory reads and writes so configured authorization providers enforce permissions with actor and acting-agent attribution across standard, durable, and delegated execution paths. Applications without an authorization provider are unchanged. Applications with an authorization provider must grant `memory:read` and `memory:write` for the affected memory threads to users and system actors that run agents in process; otherwise those operations now fail with a 403 response.
