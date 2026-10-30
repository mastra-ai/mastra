---
'@mastra/core': patch
---

Fixed messages being silently dropped after a thread's run finished, for example when Redis restarted mid-session or another process missed the run's completion event. `sendMessage` resolved instantly without running the agent, and every later message on that thread was dropped the same way. A finished run is no longer treated as the thread's active run, and a run in another process only counts as delivered once it confirms it accepted the message; otherwise the message starts a new run.
