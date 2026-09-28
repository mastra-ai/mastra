---
'@mastra/core': patch
---

Fixed `DurableAgent` construction to preserve dynamic model resolution until request context is available. Wrapping an agent with a request-dependent model no longer resolves the model eagerly during startup.
