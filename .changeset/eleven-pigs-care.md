---
'@mastra/factory': patch
---

Terminal dispatch failures now open a supervisor finding and ring the supervisor immediately, before any health sweep. The finding is written first through the sweep's own key derivation (so reconciliation neither resolves nor duplicates it), then a high-priority notification carrying the failure code is sent, question-shaped failures included. Delivery is at-least-once: if the sweep and the dispatcher race on the same finding the supervisor may hear the doorbell twice, never zero times.
