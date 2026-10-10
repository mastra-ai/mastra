---
'@mastra/core': patch
---

Fixed durable agents (such as Inngest agents) silently dropping call-time `toolsets` when the worker runs in a separate process. Toolset tools contain server-side code that can't be serialized, so the worker now throws an error naming the missing tools instead of running without them. To use these tools on a separate worker, register them on the agent (statically or via `requestContext`).
