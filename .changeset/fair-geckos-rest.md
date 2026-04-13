---
'@mastra/observability': patch
---

Reduced observability overhead for `MODEL_STEP` spans by storing a lightweight message preview of request bodies.

This keeps span previews readable and avoids pulling large payloads into exporter input.
