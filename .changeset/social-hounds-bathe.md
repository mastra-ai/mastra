---
'@mastra/factory': minor
---

Added a `firstMessageAt` timestamp to Factory source-control sessions. The session's first agent run now records when the first message reached the agent, so session listings and latency reporting can measure time-to-first-response from the real conversation start instead of the session's creation time (which can be long before the user sends anything). The value is returned on session objects from the source-control sessions API and is write-once: later messages never move it.
