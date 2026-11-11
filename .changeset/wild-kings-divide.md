---
'@mastra/server-adapters-test-suite': patch
---

Added shared HTTP conformance tests that check a client disconnect stops a custom route's agent run after garbage collection, and that a custom route's request is released once its streamed response ends.
