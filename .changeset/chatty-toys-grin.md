---
'@mastra/factory': patch
---

Fixed Factory sessions that stopped responding after a server restart. GitHub webhook deliveries now restore the saved session owner when they rebuild a session, so the delivery goes through and the session picks up where it left off.
