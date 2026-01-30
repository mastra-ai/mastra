# Observability

Mastra's unified observability system for AI applications.

## Contents

### Core Documentation
- [Architecture & Configuration](./architecture-configuration.md) - System architecture and configuration
- [Tracing](./tracing.md) - Span types, attributes, and token tracking
- [Metrics](./metrics.md) - Metric types, naming conventions, and built-in catalog
- [Logging](./logging.md) - Log levels, auto-correlation, and Logger API
- [Exporters](./exporters.md) - Exporter packages for various backends

### Evaluation & Quality
- [Datasets](./datasets/README.md) - Test case collections for evaluation
- [Experiments](./experiments.md) - Running and comparing evaluations

### Planning & Research
- [Plan / Analysis](./plan-analysis.md) - Langfuse comparison and feature gap analysis
- [User Anecdotes](./user-anecdotes.md) - User feedback on observability needs

---

## Overview

Mastra Observability provides three complementary signals for understanding AI application behavior, plus quality evaluation through datasets and experiments.

---

## The Three Signals

### Tracing

Traces capture the causal structure and timing of executions. Mastra automatically instruments agent runs, workflow steps, tool calls, and model generations as hierarchical spans. Traces answer: *"How did it flow? What was slow? What called what?"*

→ See [Tracing](./tracing.md) for span types, attributes, and token tracking

### Metrics

Metrics provide aggregate health and trend data. Counters track totals (requests, errors, tokens), histograms capture distributions (latency, token counts). Metrics answer: *"Is something wrong? How bad? Where?"*

→ See [Metrics](./metrics.md) for metric types, naming conventions, and built-in catalog

### Logging

Logs capture specific events and context from user code. Each log auto-correlates with the active trace via traceId/spanId. Logs answer: *"What happened? What was the input/output?"*

→ See [Logging](./logging.md) for log levels, auto-correlation, and the Logger API

### HTTP Server Instrumentation

All HTTP requests to the Mastra server are automatically instrumented with traces, metrics, and logs (Sentry-style). User-added endpoints get observability for free.

→ See [Observability Architecture & Configuration](./architecture-configuration.md) for auto-instrumentation details

---

## Design Principles

- **Automatic when enabled** — Enable observability → automatically get traces + metrics + logs
- **Zero-config instrumentation** — Built-in metrics emitted without additional configuration
- **Correlation by design** — All signals share common dimensions for cross-signal navigation
- **Pluggable storage** — Same storage domain pattern as other Mastra components
- **Export flexibility** — Support for Mastra Cloud, Grafana, OTLP, and custom exporters

---

## Datasets & Experiments

**Datasets** are collections of test cases for systematically evaluating AI agents and workflows. They enable teams to catch quality issues before production and compare different approaches objectively.

**Experiments** run datasets against agents or workflows, scoring each result and persisting outcomes for analysis. Experiments can be compared across versions to track quality trajectory over time.

Together, datasets and experiments provide the "quality" dimension—while traces, metrics, and logs answer "what happened", experiments answer "is it working correctly?"

→ See [Datasets](./datasets/README.md) and [Experiments](./experiments.md) for details

---

## Future: Automated Agent Tuning

The long-term vision is to close the loop between observability and optimization:

- **Production → Datasets**: Automatically capture interesting traces (failures, edge cases) as new dataset items
- **Metrics → Experiments**: Trigger experiments when metrics drift beyond thresholds
- **Experiments → Optimization**: Use results to suggest or apply prompt improvements
- **Continuous evaluation**: Run experiments on a schedule against production-sampled data

This creates a feedback loop where observability data drives quality improvements, and experiments validate those improvements before deployment.
