# Phase 1: Foundation

**Status:** Planning
**Prerequisites:** None
**Estimated Scope:** Core infrastructure for unified observability

---

## Overview

Phase 1 establishes the foundational infrastructure for the unified observability system:
- Event bus architecture
- Exporter signal support declarations
- Context injection for `logger` and `metrics`
- DuckDB storage adapter for local development

---

## Package Change Strategy

Changes are organized by npm package to enable independent PRs and avoid cross-package breaking changes.

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 1.1 | `@mastra/core` | Interfaces, types, context changes | [pr-1.1-core-changes.md](./pr-1.1-core-changes.md) |
| PR 1.2 | `@mastra/observability` | Event buses, base exporter updates | [pr-1.2-observability-changes.md](./pr-1.2-observability-changes.md) |
| PR 1.3 | `stores/duckdb` | DuckDB observability storage | [pr-1.3-duckdb-adapter.md](./pr-1.3-duckdb-adapter.md) |
| PR 1.4 | Individual exporters | Signal support declarations | [pr-1.4-exporter-declarations.md](./pr-1.4-exporter-declarations.md) |

---

## Dependencies Between PRs

```
PR 1.1 (@mastra/core)
    ↓
PR 1.2 (@mastra/observability) ← depends on core types
    ↓
PR 1.3 (stores/duckdb) ← depends on core storage interface
    ↓
PR 1.4 (exporters) ← depends on observability base
```

**Merge order:** 1.1 → 1.2 → 1.3 → 1.4

---

## Definition of Done

- [ ] All PRs merged
- [ ] All contexts have `tracing`, `logger`, `metrics` (with no-ops)
- [ ] Event buses implemented and wired
- [ ] All existing exporters declare signal support
- [ ] DuckDB adapter stores and retrieves spans
- [ ] Existing tests pass
- [ ] New tests for all added functionality

---

## Open Questions

1. Should we add a changeset for each PR, or one for the whole phase?
2. Do we need migration guides for the deprecated `tracingContext`?
3. Should DuckDB be the default storage for local dev automatically?
