---
'@mastra/factory': patch
---

Opening a teammate's session in Factory is faster: the server now looks up the owner, admin rights, and ownership options at the same time instead of one after another.

When custom provider storage fails to start, Factory now retries it at most every 15 seconds instead of on every request.
