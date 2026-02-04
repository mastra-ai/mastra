# Phase 3: Metrics

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation), Phase 2 (Logging)
**Estimated Scope:** MetricsContext implementation, auto-extracted metrics, storage

---

## Overview

Phase 3 implements the metrics system with both direct API and auto-extracted metrics:
- MetricsContext implementation with auto-labels and cardinality protection
- MetricRecord schema and storage methods
- MetricEvent → exporter routing via ObservabilityBus
- TracingEvent → MetricEvent cross-emission for auto-extracted metrics
- Built-in metrics catalog

---

## Package Change Strategy

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 3.1 | `@mastra/core` | MetricRecord schema, storage interface, cardinality config | [pr-3.1-core-changes.md](./pr-3.1-core-changes.md) |
| PR 3.2 | `@mastra/observability` | MetricsContext impl, auto-extraction, ObservabilityBus wiring | [pr-3.2-observability-changes.md](./pr-3.2-observability-changes.md) |
| PR 3.3 | `stores/duckdb` | Metrics table and methods | [pr-3.3-duckdb-metrics.md](./pr-3.3-duckdb-metrics.md) |
| PR 3.4 | `stores/clickhouse` | Metrics table and methods | [pr-3.4-clickhouse-metrics.md](./pr-3.4-clickhouse-metrics.md) |

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
| `mastra_model_input_tokens` | counter | model, provider, agent, token_type |
| `mastra_model_output_tokens` | counter | model, provider, agent, token_type |

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
| `mastra_scores_total` | counter | scorer, entity_type, entity_name, experiment |
| `mastra_feedback_total` | counter | feedback_type, source, experiment |

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Auto-extracted metrics appear when agent runs
- [ ] E2E test: Token usage metrics extracted from LLM calls
- [ ] E2E test: Direct metrics API works from tool context
- [ ] E2E test: Cardinality filter blocks high-cardinality labels
- [ ] E2E test: Metrics appear in storage and exporters
- [ ] E2E test: Aggregation queries return correct results

---

## Dependencies Between PRs

```
PR 3.1 (@mastra/core)
    ↓
PR 3.2 (@mastra/observability) ← depends on core types
    ↓
PR 3.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 3.4 (stores/clickhouse) ← depends on core storage interface
```

**Note:** PR 3.3 and PR 3.4 can be done in parallel after PR 3.2.

**Merge order:** 3.1 → 3.2 → (3.3 | 3.4)

---

## Definition of Done

- [ ] MetricsContext implementation complete
- [ ] Auto-extracted metrics flowing from span events
- [ ] Cardinality protection working
- [ ] DefaultExporter writes metrics to storage
- [ ] JsonExporter outputs metrics
- [ ] DuckDB adapter stores and retrieves metrics with aggregation
- [ ] ClickHouse adapter stores and retrieves metrics with aggregation
- [ ] All tests pass
- [ ] Documentation updated with metrics catalog

---

## Open Questions

1. Should histogram buckets be configurable per-metric or global?
2. What should the default histogram boundaries be?
3. Should we add pre-aggregation for common time-series queries?
4. Do we need a separate metrics registry for discovery?
