---
'@mastra/server': patch
---

The session state endpoint now reports `runningThreadId`, the thread the active run is on, next to `running`. It is `null` while idle, so UIs can tell a run on the viewed thread from a run elsewhere in the session.
