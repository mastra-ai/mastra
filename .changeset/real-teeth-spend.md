---
'@mastra/code-sdk': patch
---

Fixed cross-agent signals so a peer stays reachable after a session moves to another conversation. A session advertised only its active thread, so peers that had saved an earlier thread could no longer send messages to it after the user started a new thread or switched threads. Every thread a session has loaded now stays claimed, and a wake sent to a saved thread runs on that thread instead of the session's current one.
