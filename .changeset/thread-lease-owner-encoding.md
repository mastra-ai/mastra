---
'@mastra/core': minor
---

Fixed a recovered thread run losing its thread lease when the execution it replaced finished. Previously, when a run was recovered in another process, the original execution's exit released the shared lease while the recovered execution was still running, so the thread looked free and a new run could start on it. Each execution now holds the lease under its own generation, so only the live execution can renew or release it.

Also fixed run IDs that contain the internal handover marker, or look like an encoded lease owner, being misread as a different run. Any caller-provided run ID now round-trips unchanged.

**Upgrading shared deployments**

Drain active thread runs and restart API and worker processes together. Older processes do not recognize the new lease owner format: they cannot see a run as live, even while it is renewing its lease. Follow-ups that an older process forwards to a run on this release are still delivered.
