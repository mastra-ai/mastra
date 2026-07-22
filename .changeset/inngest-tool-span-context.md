---
'@mastra/inngest': patch
---

Fixed durable tool execution on the Inngest engine running with no tracing context. Spans created inside tool execution — workspace `WORKSPACE_ACTION` filesystem spans, client-tool spans — were silently skipped, because the engine's `extract-tool-calls` map did not forward the LLM step's `stepSpanData` onto each tool call the way core's engine does. With the context forwarded, the tool builder creates the live `TOOL_CALL` span itself with execution-time children correctly nested, so the collect step's retroactive `TOOL_CALL` creation (which produced childless duplicate spans) was removed; its `tool-result` chunk spans and step-span bookkeeping are unchanged.

Adds a cross-process regression test (real connect() worker) asserting exactly one `tool_call` span per tool and a `workspace_action` span nested under its `tool_call`.
