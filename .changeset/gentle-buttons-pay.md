---
'@mastra/pg': patch
---

Added atomic evented workflow step occurrence guards so another worker can continue interrupted agent runs without stale deliveries overwriting completed results. Upgrade alongside @mastra/core and drain runs started on older versions first.
