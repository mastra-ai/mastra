---
'@mastra/core': patch
---

Fixed tool approval resume failing when Agent is used without an explicit Mastra instance. The Harness now creates an internal Mastra instance with storage and registers it on mode agents, ensuring workflow snapshots persist and load correctly. Also fixed requestContext serialization using toJSON() to prevent circular reference errors during snapshot persistence.
