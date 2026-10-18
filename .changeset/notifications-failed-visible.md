---
'@mastra/core': patch
---

Fixed notifications that ran out of delivery attempts disappearing from the inbox. The `notification-inbox` tool's default `list` now includes `failed` notifications, reporting them as `failed` with their last delivery error, and marks them seen so they show up once rather than on every list.
