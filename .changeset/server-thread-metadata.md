---
'@mastra/server': patch
---

Fixed server agent routes dropping `memory.thread` fields such as `metadata` and `title`. Passing `memory: { thread: { id, metadata }, resource }` to the generate, stream, stream-until-idle, resume, and workflow-builder routes now creates threads with that metadata, matching in-process `agent.generate()`. Fixes #27471.
