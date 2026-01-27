---
'@mastra/core': patch
---

Fixed output processors not being applied to messages saved during network execution. When using agent.network(), configured output processors (like TraceIdInjector for feedback attribution) are now correctly applied to all messages before they are saved to storage.
