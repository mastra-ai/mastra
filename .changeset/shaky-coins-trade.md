---
'@mastra/core': patch
---

Fixed evented workflow runs that ran steps again after they had already ended. This happened when a step event was delivered late, for example when the message broker handed an unacknowledged message from a stopped worker to another worker. A finished run now ignores late step events instead of running steps again, and a late failure no longer marks a successful run as failed.
