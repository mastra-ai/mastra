---
'@mastra/core': patch
---

Fixed Mastra getting stuck after a storage startup failure. Previously, if storage couldn't start up (for example, because the database was briefly unreachable), Mastra would keep returning the same error for every operation until the process was restarted. Now the next storage operation tries to start storage again, so brief outages recover on their own. Storage startup failures are also logged, so the problem is visible even when a later retry succeeds.
