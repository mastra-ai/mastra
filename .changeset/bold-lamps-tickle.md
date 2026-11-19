---
'@mastra/factory': patch
---

Improved Factory responsiveness under load. The background check that catches tool results missed at the end of a run now reads only the sessions that ran since its last pass, instead of every active session every 30 seconds. It still checks every active session on startup and every 10 minutes as a safety net, reads a few sessions at a time, and no longer re-processes the last message it already handled.
