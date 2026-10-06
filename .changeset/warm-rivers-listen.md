---
'@mastra/core': patch
---

Fixed internal agent memory reads and writes so configured authorization providers enforce permissions with actor and acting-agent attribution across standard, durable, and delegated execution paths. Applications without an authorization provider are unchanged.
