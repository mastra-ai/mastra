# Phase 3: Logging, Metrics & Scores/Feedback

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation), Phase 2 (Debug Exporters)
**Estimated Scope:** LoggerContext, MetricsContext, Score/Feedback APIs implementation

---

## Overview

Phase 3 implements all signal context implementations in `@mastra/observability`:
- **Logging:** LoggerContext with automatic trace correlation
- **Metrics:** MetricsContext with cardinality protection and auto-extracted metrics
- **Scores & Feedback:** span/trace APIs for quality evaluation

**Note:**
- All core types (ExportedLog, ExportedMetric, ExportedScore, ExportedFeedback, etc.) are defined in Phase 1 (PR 1.1)
- Exporter support is already implemented in Phase 2 (Debug Exporters)
- Storage adapters are implemented in Phase 6

---

## Package Change Strategy

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 3.1 | `@mastra/observability` | LoggerContext implementation, mastra.logger | [pr-3.1-logging.md](./pr-3.1-logging.md) |
| PR 3.2 | `@mastra/observability` | MetricsContext, cardinality, mastra.metrics | [pr-3.2-metrics.md](./pr-3.2-metrics.md) |
| PR 3.3 | `@mastra/observability` | TracingEvent → MetricEvent auto-extraction | [pr-3.3-auto-extract.md](./pr-3.3-auto-extract.md) |
| PR 3.4 | `@mastra/observability` | Score/Feedback APIs, Trace class | [pr-3.4-scores-feedback.md](./pr-3.4-scores-feedback.md) |
| PR 3.5 | `@mastra/observability` | Score/Feedback metric auto-extraction | [pr-3.5-score-feedback-metrics.md](./pr-3.5-score-feedback-metrics.md) |

**Merge order:** 3.1 → 3.2 → 3.3 → 3.4 → 3.5

**Changeset:** One changeset per PR

---

## Built-in Metrics Catalog

Reference table for auto-extracted metrics:

### Agent Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_agent_runs_started` | counter | agent, env, service |
| `mastra_agent_runs_ended` | counter | agent, status, env, service |
| `mastra_agent_duration_ms` | histogram | agent, status, env, service |

### Model Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_model_requests_started` | counter | model, provider, agent |
| `mastra_model_requests_ended` | counter | model, provider, agent, status |
| `mastra_model_duration_ms` | histogram | model, provider, agent |
| `mastra_model_input_tokens` | counter | model, provider, agent |
| `mastra_model_output_tokens` | counter | model, provider, agent |
| `mastra_model_cache_read_tokens` | counter | model, provider, agent |
| `mastra_model_cache_write_tokens` | counter | model, provider, agent |

### Tool Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_tool_calls_started` | counter | tool, agent, env |
| `mastra_tool_calls_ended` | counter | tool, agent, status, env |
| `mastra_tool_duration_ms` | histogram | tool, agent, env |

### Workflow Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_workflow_runs_started` | counter | workflow, env |
| `mastra_workflow_runs_ended` | counter | workflow, status, env |
| `mastra_workflow_duration_ms` | histogram | workflow, status, env |

### Score/Feedback Metrics
| Metric | Type | Labels |
|--------|------|--------|
| `mastra_scores_total` | counter | scorer, entity_type, experiment |
| `mastra_feedback_total` | counter | feedback_type, source, entity_type, experiment |

---

## Integration Testing

After PR merged:

**Logging Tests:**
- [ ] E2E test: Log from tool, verify trace correlation
- [ ] E2E test: Log from workflow step, verify trace correlation
- [ ] E2E test: Logs appear in JsonExporter output
- [ ] E2E test: LogEvents routed through ObservabilityBus

**Metrics Tests:**
- [ ] E2E test: Auto-extracted metrics appear when agent runs
- [ ] E2E test: Token usage metrics extracted from LLM calls
- [ ] E2E test: Direct metrics API works from tool context
- [ ] E2E test: Cardinality filter blocks high-cardinality labels
- [ ] E2E test: MetricEvents routed through ObservabilityBus

**Score/Feedback Tests:**
- [ ] E2E test: Add score to active span
- [ ] E2E test: Add feedback to active span
- [ ] E2E test: Add score to trace (no span)
- [ ] E2E test: Retrieve trace and add post-hoc score
- [ ] E2E test: Retrieve trace and add post-hoc feedback
- [ ] E2E test: ScoreEvents/FeedbackEvents routed through ObservabilityBus

---

## Definition of Done

**Logging:**
- [ ] LoggerContext implementation complete
- [ ] Logs emitted from tools/workflows have trace correlation
- [ ] LogEvent emission to ObservabilityBus working

**Metrics:**
- [ ] MetricsContext implementation complete
- [ ] Auto-extracted metrics flowing from span events
- [ ] Cardinality protection working
- [ ] MetricEvent emission to ObservabilityBus working

**Scores & Feedback:**
- [ ] span.addScore() and span.addFeedback() working
- [ ] trace.addScore() and trace.addFeedback() working
- [ ] mastra.getTrace() returns Trace with spans
- [ ] Post-hoc score/feedback attachment working
- [ ] ScoreEvent/FeedbackEvent emission to ObservabilityBus working

**General:**
- [ ] All tests pass
- [ ] Documentation updated

---

## Open Questions

1. Should we add a `mastra.logger` direct API for logging outside trace context?
2. Should histogram buckets be configurable per-metric or global?
3. Should we support batch score/feedback creation?
4. What's the migration path from existing `addScoreToTrace` API?
