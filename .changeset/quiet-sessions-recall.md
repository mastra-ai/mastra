---
'@mastra/factory': patch
---

Restored a user session's Factory project when its controller session is rebuilt after a Factory restart. Only the organization was recovered before, so the session's Knowledge scopes silently dropped `project:<id>` and the agent filed project pages into the user's private scope instead. A rebuilt session now reads its project back from its source-control row, the same place the project is seeded from when the session is first created.
