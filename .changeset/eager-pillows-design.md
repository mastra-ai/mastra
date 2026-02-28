---
'@mastra/observability': minor
---

Added a unified observability system that automatically captures metrics, logs, and traces from agent runs, tool calls, model generations, and workflow executions.

**Automatic metrics** — Agent runs, tool calls, and workflows now automatically emit duration and count metrics with structured labels, removing the need for manual instrumentation.

**Structured logging** — Logs are automatically correlated with their parent traces and spans, making it easier to debug issues across agents and workflows.

**Cardinality protection** — Built-in filtering prevents high-cardinality labels from overwhelming metric backends.
