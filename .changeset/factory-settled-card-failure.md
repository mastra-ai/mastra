---
'@mastra/factory': patch
---

Fixed a Factory automation that failed on a card already at Done or Canceled staying in Needs attention until the server restarted. The session row and the board card kept the "waiting on you" marker, and Retry could only fail the same way again. Such a failure now settles as superseded the moment it happens, the way a restart already repaired it, so the marker clears on the next poll.
