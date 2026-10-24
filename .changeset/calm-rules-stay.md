---
'@mastra/core': patch
---

Fixed `session.permissions.setForCategory()` and `setForTool()` changing the session's permission rules even when the controller's `stateSchema` rejected the update. A rejected policy now leaves the existing rules unchanged, and concurrent policy changes no longer overwrite each other.
