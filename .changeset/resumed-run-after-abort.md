---
'@mastra/core': patch
---

Fixed `respondToToolSuspension()` never resolving when the answered tool call (for example `ask_user`) parked after its run was aborted. The resumed run now reaches the session, emits `agent_start` and `agent_end`, and leaves the session idle when it ends ([#26871](https://github.com/mastra-ai/mastra/issues/26871)).
