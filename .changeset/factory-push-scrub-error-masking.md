---
'@mastra/factory': patch
---

Fixed a failed branch push being reported as a token cleanup error. When the push failed and the token cleanup failed too, the cleanup error replaced the push error, so a push blocked by the network was reported with an unrelated error code. The push error is now reported as-is with its own code, and the cleanup error is added to the end of its message.
