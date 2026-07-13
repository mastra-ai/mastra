---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/core': patch
'mastra': patch
---

Added a run-activity peek for agent controller sessions. The session state response now includes a `running` flag, and a new `GET /agent-controller/:controllerId/sessions/:resourceId/running` route reports whether a session is executing without creating one, so UIs can poll activity indicators for idle resources safely.
