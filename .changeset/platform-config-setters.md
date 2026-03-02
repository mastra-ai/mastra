---
'@mastra/core': minor
---

Add `setObservability()` and `setServer()` public methods to the Mastra class, enabling post-construction configuration of observability and server settings. This allows platform tooling to inject defaults (e.g. tracing, auth) into user-created Mastra instances at deploy time.
