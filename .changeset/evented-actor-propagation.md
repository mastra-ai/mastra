---
'@mastra/core': patch
---

Propagate the caller's actor identity through the evented workflow engine. Previously the evented engine accepted `actor` at the API surface (used for the fine-grained-authorization gate) but dropped it before execution: `execute()` params omitted `actor` and the workflow event payloads carried `requestContext` but not `actor`, so steps, tools, and loop conditions running on the evented engine never saw the caller's identity — actor-based authorization inside tools silently saw no actor. The actor signal now rides the event envelope alongside `requestContext` across every hop (start, resume, restart, time travel, step events) and reaches step, tool, agent, and condition execution contexts, matching the default engine.
