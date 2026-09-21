---
'@mastra/code-sdk': patch
---

Fixed plugin tools so background execution is enabled only when the tool declares support; `mastra_expert` is no longer opted in by name. Removed global plugin-call serialization, allowing independently declared tools to run concurrently.
