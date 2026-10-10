---
'@mastra/core': patch
---

Fixed notifications whose immediate delivery failed from staying undeliverable. A signal that no thread owner could accept is now retried by the notification dispatcher instead of sitting pending forever, so senders can still see it delivered or terminally failed.
