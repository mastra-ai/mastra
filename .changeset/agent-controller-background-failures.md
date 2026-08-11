---
'@mastra/server': patch
---

Report background failures on the agent controller message, steer, and follow-up routes instead of crashing the server. These routes acknowledge the request immediately and let the session finish the turn in the background, so a session that failed to start (for example when a signal cannot be submitted) previously produced an unhandled rejection that terminated the process. The failure is now logged and delivered to the session's subscribers as an `error` event, so clients streaming the session are told the turn did not start.
