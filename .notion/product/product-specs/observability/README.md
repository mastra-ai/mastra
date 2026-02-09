# Observability

Mastra's unified observability system for AI applications.

## Overview

Mastra Observability provides three complementary signals for understanding AI application behavior (Tracing, Metrics, Logging), plus quality evaluation through Datasets and Experiments.

---

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

*These documents inform design decisions but are not implementation specs.*

### Future Vision
- [Mastra Pulse](./mastra-pulse.md) - Unified causal observability (experimental research)

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

---

## Scores & Feedback

In addition to the three signals, Mastra supports attaching quality scores and user feedback to traces:

- **Evaluation Scores** — Automated scores from running evals (relevance, hallucination, factuality)
- **User Feedback** — Human signals (thumbs up/down, star ratings, comments) from end-users or reviewers

Scores and feedback flow through the observability pipeline and are distributed to exporters that support them (Langfuse, Braintrust, LangSmith, storage).

→ See [Tracing - Scores](./tracing.md#scores) for details

---

## Datasets & Experiments

While the three signals answer *"what happened"*, datasets and experiments answer *"is it working correctly?"*

**Datasets** are collections of test cases for systematically evaluating AI agents and workflows. They enable teams to catch quality issues before production and compare different approaches objectively.

**Experiments** run datasets against agents or workflows, scoring each result and persisting outcomes for analysis. Experiments can be compared across versions to track quality trajectory over time.

→ See [Datasets](./datasets/README.md) and [Experiments](./experiments.md) for details

---

## Design Principles

- **Single configuration** — All observability (traces, metrics, logs) in one place
- **Automatic when enabled** — Enable observability → automatically get traces + metrics + logs
- **Zero-config instrumentation** — Built-in metrics emitted without additional configuration
- **Exporters declare capabilities** — Each exporter specifies which signals it supports
- **Correlation by design** — All signals share common dimensions for cross-signal navigation
- **Pluggable storage** — Same storage domain pattern as other Mastra components
- **Export flexibility** — Support for Mastra Cloud, Grafana, OTLP, and custom exporters

→ See [Architecture & Configuration](./architecture-configuration.md) for configuration API, storage backends, and technical details

---

## Future: Mastra Pulse

Experimental exploration of unified causal observability — replacing separate T/M/L with a single "Moment" model and first-class causality links.

→ See [Mastra Pulse](./mastra-pulse.md) for the vision and internal experimentation plan

---

## Future: Automated Agent Tuning

The long-term vision is to close the loop between observability and optimization:

- **Production → Datasets**: Automatically capture interesting traces (failures, edge cases) as new dataset items
- **Metrics → Experiments**: Trigger experiments when metrics drift beyond thresholds
- **Experiments → Optimization**: Use results to suggest or apply prompt improvements
- **Continuous evaluation**: Run experiments on a schedule against production-sampled data

This creates a feedback loop where observability data drives quality improvements, and experiments validate those improvements before deployment.
