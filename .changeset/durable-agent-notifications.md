---
'@mastra/core': patch
---

Durable agents now honor their configured `notifications.deliveryPolicy`, and forked durable agents retain their Mastra instance so notification signals can be sent from forks.
