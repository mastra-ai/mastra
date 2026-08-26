---
'@mastra/client-js': patch
---

Fixed agent-controller event subscriptions hanging forever on a silently dead connection (for example after a laptop sleep, or a network path quietly dropping). A stream that delivers nothing for 60 seconds is now closed and handled by the normal reconnect path, so `subscribe({ reconnect })` recovers on its own instead of staying "connected" with no events. The server's periodic heartbeats keep a healthy idle stream alive.
