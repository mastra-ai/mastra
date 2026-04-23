---
'@mastra/react': patch
---

The useChat hook stream now calls the new `agent.streamUntilIdle` method and the background-task chunks are processed in toUIMessage.
