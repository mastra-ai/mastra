---
'@mastra/core': patch
---

Fixed notifications getting stuck when the delivery policy throws while the notification is being sent. The notification now records a failed delivery attempt and is retried by the notification dispatcher, up to the attempt limit, instead of staying pending forever.
