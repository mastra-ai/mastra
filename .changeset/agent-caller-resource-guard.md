---
'@mastra/core': patch
---

`Agent` and `DurableAgent` now reject sends and tool approvals when the resource id in the caller's `requestContext` does not match the resource that owns the target thread or run. `sendSignal` also accepts a top-level `requestContext` option for this check.
