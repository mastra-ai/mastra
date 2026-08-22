---
'@mastra/server': minor
---

Thread subscriptions now emit an initial transient `data-thread-state` chunk so refreshed and secondary clients immediately receive the thread's running, suspended, or idle state.
