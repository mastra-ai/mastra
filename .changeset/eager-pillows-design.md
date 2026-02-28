---
'@mastra/observability': minor
---

Adds the ObservabilityBus with built-in promise tracking and flush support, laying the groundwork for fixing #13388 where spans were lost in durable execution contexts.

Introduces new metrics and structured logging contexts as standalone features:

**Automatic metrics** — New auto-extracted metrics emit duration and count metrics for agent runs, tool calls, and workflows with structured labels, removing the need for manual instrumentation.

**Structured logging** — New LoggerContext provides trace-correlated logging, automatically linking logs to their parent traces and spans for easier debugging across agents and workflows.

**Cardinality protection** — New CardinalityFilter prevents high-cardinality labels from overwhelming metric backends.
