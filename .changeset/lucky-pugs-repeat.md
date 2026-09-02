---
'@mastra/core': patch
---

Stop `_background` from leaking between agents that share a tool instance.

`CoreToolBuilder` wrote the schema it splices (`_background`, `suspendedToolRunId`, `resumeData`)
back onto `originalTool.inputSchema` — the caller's own tool object, which is normally a
module-level singleton registered on several agents. That was harmless while eligibility was a
single Mastra-level flag, but since eligibility became per agent and per tool, the first agent to
convert a tool decided what every other agent's model saw: an agent that opted nothing in was
still advertised `_background`, which the runtime then refused to honor.

The spliced schema now lives on the builder, so the shared tool object is never mutated. Because
the injected keys are consequently no longer declared on the tool's own schema, the builder marks
its arguments as already validated whenever it injected keys — it validates them itself against
the spliced schema — so `Tool.execute` does not strip `suspendedToolRunId` and sub-agent and
workflow resume keep working.

This also stops repeated conversions of a Zod v3 or JSON Schema tool from nesting an extra
override validator on every call.
