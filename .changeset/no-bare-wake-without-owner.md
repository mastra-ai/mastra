---
'@mastra/code-sdk': patch
---

Fixed notifications failing with "No model available: this run started without a controller session context" when several Mastra Code processes share one database and one of them was created with its own `pubsub`. That process no longer wakes a thread for a resource none of its sessions serve. It leaves the notification pending, without counting a delivery attempt, for the process that serves the resource.
