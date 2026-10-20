---
'@mastra/core': patch
---

A run waiting on a tool approval or suspension now keeps its saved snapshot when the thread lease backend (e.g. Redis) is unreachable for longer than the lease TTL, or loses the lease. Before, the lease-loss abort deleted the snapshot, so the pending approval could no longer be resumed. The parked run now resumes normally once the backend is back, holding the thread lease again while it runs. A durable or evented resume is refused, and the run stays parked, if another run took the thread lease in the meantime.
