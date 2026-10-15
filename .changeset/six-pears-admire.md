---
'@mastra/factory': patch
---

Fixed Slack mentions failing with "Tenant model credential policy could not be resolved". New Slack sessions now open directly on their Slack thread and no longer leave an extra empty thread behind.
