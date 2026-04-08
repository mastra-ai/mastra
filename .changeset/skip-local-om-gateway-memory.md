---
'@mastra/memory': patch
---

Fixed message history doubling when using Observational Memory with the Mastra gateway. The local ObservationalMemoryProcessor now detects when the agent's model is routed through the Mastra gateway and skips its input/output processing, since the gateway handles OM server-side.
