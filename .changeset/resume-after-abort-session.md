---
'@mastra/core': patch
---

Fixed `respondToToolSuspension()` hanging when answering a tool call (such as `ask_user`) that was parked during a run you aborted. The resumed run now streams to the Session and completes normally, instead of being silently dropped.
