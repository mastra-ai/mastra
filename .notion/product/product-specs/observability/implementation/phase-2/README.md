# Phase 2: Logging

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation), Phase 1.5 (Debug Exporters)
**Estimated Scope:** LoggerContext implementation, storage, exporters

---

## Overview

Phase 2 implements the structured logging system with automatic trace correlation:
- LoggerContext implementation with auto-correlation
- LogRecord schema and storage methods
- LogEvent → exporter routing via ObservabilityBus
- Exporter support for logs signal

---

## Package Change Strategy

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 2.1 | `@mastra/core` | LogRecord schema, storage interface extensions | [pr-2.1-core-changes.md](./pr-2.1-core-changes.md) |
| PR 2.2 | `@mastra/observability` | LoggerContext impl, ObservabilityBus wiring, exporters | [pr-2.2-observability-changes.md](./pr-2.2-observability-changes.md) |
| PR 2.3 | `stores/duckdb` | Logs table and methods | [pr-2.3-duckdb-logs.md](./pr-2.3-duckdb-logs.md) |
| PR 2.4 | `stores/clickhouse` | Logs table and methods | [pr-2.4-clickhouse-logs.md](./pr-2.4-clickhouse-logs.md) |

---

## Integration Testing

After all PRs merged:

**Tasks:**
- [ ] E2E test: Log from tool, verify trace correlation
- [ ] E2E test: Log from workflow step, verify trace correlation
- [ ] E2E test: Logs appear in DefaultExporter storage
- [ ] E2E test: Logs appear in JsonExporter output
- [ ] E2E test: Filter logs by trace ID
- [ ] E2E test: Search logs by message content

---

## Dependencies Between PRs

```
PR 2.1 (@mastra/core)
    ↓
PR 2.2 (@mastra/observability) ← depends on core types
    ↓
PR 2.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 2.4 (stores/clickhouse) ← depends on core storage interface
```

**Note:** PR 2.3 and PR 2.4 can be done in parallel after PR 2.2.

**Merge order:** 2.1 → 2.2 → (2.3 | 2.4)

---

## Definition of Done

- [ ] LoggerContext implementation complete
- [ ] Logs emitted from tools/workflows have trace correlation
- [ ] DefaultExporter writes logs to storage
- [ ] JsonExporter outputs logs
- [ ] DuckDB adapter stores and retrieves logs
- [ ] ClickHouse adapter stores and retrieves logs
- [ ] All tests pass
- [ ] Documentation updated

---

## Open Questions

1. Should we add a `mastra.logger` direct API for logging outside trace context?
2. What should the default log retention be for ClickHouse?
3. Should we support structured logging format standards (like OpenTelemetry Logs)?
