---
'@mastra/core': patch
---

Fix sub-agent delegation permanently grafting the supervisor's memory onto a memory-less sub-agent instance. Sub-agents are usually long-lived singletons, so the first supervisor to delegate would set its memory on the shared instance and every later supervisor — and every direct invocation of that sub-agent — would keep reading and writing that first supervisor's memory. The supervisor's memory is now passed through the delegated run's request context, so inheritance applies for that invocation only and the sub-agent instance is never mutated.

Inherited memory is scoped to a single in-process delegation: it applies to the sub-agent the supervisor delegated to and not to agents that sub-agent delegates to in turn, and it is not carried across a durable run's suspend/resume boundary. A sub-agent that needs memory in its own right should declare it, as before.
