---
'@mastra/observability': minor
---

Adds the ObservabilityBus with built-in promise tracking and flush support, laying the groundwork for fixing #13388 where spans were lost in durable execution contexts.

**Automatic metrics** — Agent runs, tool calls, and workflows now automatically emit duration and count metrics with structured labels, removing the need for manual instrumentation.

**Structured logging** — Logs are automatically correlated with their parent traces and spans, making it easier to debug issues across agents and workflows.

**Cardinality protection** — Built-in filtering prevents high-cardinality labels from overwhelming metric backends.
