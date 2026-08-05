---
'@mastra/core': patch
---

Prevented tool results and durable request-context snapshots from hanging the event loop when they contain deeply shared object graphs. Serialization now uses a bounded check, so an acyclic value with layered shared references (which `JSON.stringify` would expand exponentially) is handled in milliseconds instead of blocking for minutes. Over-budget tool results are still returned — repeated references are collapsed to `[Circular]` — rather than dropped.
