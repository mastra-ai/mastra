---
'@mastra/core': patch
---

Fixed a run being stopped as if another run had taken its thread when its process stalled past the thread lease duration while a lease renewal was in flight. The renewal's late answer now counts as a lapse this process can recover from: the run takes its lease back when nobody else holds it, and stops if it can't.
