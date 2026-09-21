---
'@mastra/core': patch
---

Fixed `requestContextSchema` being silently ignored by durable and evented agents. `DurableAgent.stream()` (and evented subclasses) now validate the request context against the agent's `requestContextSchema` before starting execution, matching `Agent.stream()` and `Agent.generate()`. Invalid or missing context values now reject with the same validation error, instead of the run starting with unvalidated context.
