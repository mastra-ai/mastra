---
'@mastra/factory': patch
---

Fixed the workspace files panel in Factory web returning "Path is outside the browsable root" for Factory sessions. The workspace file endpoints now recognize a session id, reattach to that session's sandbox, and list and read rendered files (like .artifacts) directly from the sandbox, so session artifacts render on deployed factories.
