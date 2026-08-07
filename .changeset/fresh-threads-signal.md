---
'@mastra/client-js': minor
'@mastra/react': minor
'@mastra/server': minor
---

Added a platform-neutral thread-signals client and headless React hook for browsers and React Native. The new conditional exports subscribe before loading history, expose the active run snapshot, reconnect through the native thread subscription, and provide native message, queue, approval, abort, and history operations without importing web UI or Node-only runtime code.

Thread subscriptions now emit an initial transient `data-thread-state` chunk so a refreshed or second client immediately receives the thread's running, suspended, or idle state.
