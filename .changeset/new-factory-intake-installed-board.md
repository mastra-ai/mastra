---
'mastra': patch
---

Fixed New Factory creation with a Linear or Jira project on deployments that don't install the built-in Work board. Creation no longer fails with `Board 'work' is not installed`; the project is routed to the new Factory without a board, and intake settings prompt you to choose one.
