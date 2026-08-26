---
'@mastra/client-js': patch
---

Fixed agent-controller event subscriptions hanging forever on a silently dead connection (laptop sleep, NAT timeout). A stream that delivers nothing for 60 seconds is now dropped and handled by the normal reconnect path, so `subscribe({ reconnect })` recovers on its own instead of staying "connected" with no events. The server's SSE heartbeats keep a healthy idle stream alive.
