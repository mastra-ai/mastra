---
'@mastra/server': patch
---

Initialize agent-controller event streams with a session snapshot containing the latest run's messages, current streaming message ID, and display state. Clients joining during a long tool execution can show the ongoing conversation immediately.
