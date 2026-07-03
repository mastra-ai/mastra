---
'@mastra/core': patch
---

Fixed the internal notification dispatcher starting the workflow scheduler in every app. Since 1.39.0 every Mastra instance registered the notification dispatch cron at boot, which kept the scheduler polling storage every 10 seconds — generating constant network traffic to remote databases (like Turso) and preventing serverless containers from ever scaling to zero. The dispatch schedule now activates lazily on the first deferred or summarized notification, so apps that never defer notifications no longer run a scheduler at all. Stale dispatcher schedule rows left behind by earlier versions are cleaned up automatically the next time a scheduler runs. Fixes #18864.
