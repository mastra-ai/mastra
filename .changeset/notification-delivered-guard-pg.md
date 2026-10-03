---
'@mastra/pg': patch
---

Implement `markNotificationDelivered()` as a single conditional write so the notification dispatcher never downgrades a notification that was marked seen, dismissed, or archived while its signal was being sent.
