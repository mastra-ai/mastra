---
'@mastra/core': patch
---

Fixed a run being stopped as if another run had taken its thread when its process stalled past the thread lease TTL while a lease renewal was in flight. The renewal's late answer now counts as a lapse this process can recover from, so the run takes its lease back when nobody else holds it, and stops only when another run really owns the thread.
