---
'@mastra/server': patch
'@mastra/core': patch
---

Added public read-only thread query methods (`queryThreads`, `queryThreadById`, `queryThreadMessages`) on `AgentController`. These read directly from storage without constructing a Session, so callers can list threads or fetch messages without triggering the workspace/sandbox initialization that `createSession` performs as a side effect.
