# Phase 1: Foundation

**Status:** Planning
**Prerequisites:** None
**Estimated Scope:** Core infrastructure for unified observability

---

## Overview

Phase 1 establishes the foundational infrastructure for the unified observability system:
- Type architecture (Input → Exported → Record pattern)
- Event bus architecture (ObservabilityBus)
- Context injection for `logger` and `metrics`
- BaseExporter updates (existing exporters work via inheritance)
- Unified ObservabilityConfig on Mastra
- SessionId support in TracingOptions and span propagation
- Deprecation of top-level `logger` config (with migration path)

---

## Package Change Strategy

Changes are organized by npm package to enable independent PRs and avoid cross-package breaking changes.

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 1.1 | `@mastra/core` | Interfaces, types, context changes | [pr-1.1-core-changes.md](./pr-1.1-core-changes.md) |
| PR 1.2 | `@mastra/observability` | Event buses, base exporter updates | [pr-1.2-observability-changes.md](./pr-1.2-observability-changes.md) |

**Note:** Individual exporter updates are not needed in Phase 1. The BaseExporter class implements `onTracingEvent()` which delegates to the existing `exportTracingEvent()` method, so all existing exporters automatically work through inheritance.

**Note:** Storage adapters (DuckDB, ClickHouse) are implemented in Phase 6 after all signal implementations are complete.

---

## Type Architecture

Phase 1 establishes the three-tier type pattern for all signals:

| Tier | Purpose | Serializable |
|------|---------|--------------|
| **Input** | User-facing API parameters | Not required |
| **Exported** | Event bus transport, exporter consumption | **Required** |
| **Record** | Storage format, database schemas | Required |

This pattern is defined in Phase 1 for all signals (tracing, logs, metrics, scores, feedback), even though the context APIs that emit them are built in later phases.

---

## Dependencies Between PRs

```
PR 1.1 (@mastra/core)
    ↓
PR 1.2 (@mastra/observability) ← depends on core types
```

**Merge order:** 1.1 → 1.2

---

## SessionId Support

SessionId enables grouping of traces across multi-turn conversations:

```typescript
export interface TracingOptions {
  runId?: string;
  threadId?: string;
  requestId?: string;
  sessionId?: string;  // NEW: Multi-turn conversation grouping
}
```

**Included in PR 1.1:**
- Add `sessionId` to TracingOptions
- Add `defaultSessionId` to ObservabilityConfig
- SessionId propagates through span creation and context

---

## Config Deprecation

The top-level `logger` config is deprecated in favor of unified `observability` config:

```typescript
// DEPRECATED
const mastra = new Mastra({
  logger: 'debug',
});

// NEW
const mastra = new Mastra({
  observability: {
    serviceName: 'my-app',
    logLevel: 'debug',
    exporters: [/* ... */],
  },
});
```

**Migration:** Old config still works with deprecation warning. See PR 1.1 for details.

---

## Definition of Done

- [ ] All PRs merged
- [ ] Type architecture defined (Input/Exported/Record for all signals)
- [ ] All contexts have `tracing`, `logger`, `metrics` (with no-ops)
- [ ] ObservabilityBus implemented and wired
- [ ] BaseExporter implements `onTracingEvent()` (existing exporters work via inheritance)
- [ ] Unified ObservabilityConfig on Mastra
- [ ] SessionId support in TracingOptions and propagation
- [ ] Top-level `logger` config deprecated with warning
- [ ] Existing tests pass
- [ ] New tests for all added functionality

---

## Open Questions

1. Should we add a changeset for each PR, or one for the whole phase?
2. Do we need migration guides for the deprecated `tracingContext`?
3. How long to maintain backward compatibility for deprecated `logger` config?
