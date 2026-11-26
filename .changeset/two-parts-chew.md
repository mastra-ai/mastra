---
'@mastra/core': minor
---

Added provider generate parity and retained durable run outcomes for reconnectable calls.

`await durableAgent.generate('Hello')` now invokes the provider's non-streaming generation method, while `durableAgent.stream('Hello')` continues to use provider streaming.
