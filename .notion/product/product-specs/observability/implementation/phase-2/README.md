# Phase 2: Debug Exporters

**Status:** Planning
**Prerequisites:** Phase 1 (Foundation)
**Estimated Scope:** Debug exporters for development and production visibility

---

## Overview

Phase 2 builds exporters for ALL signals early to validate interfaces and provide developer visibility:
- GrafanaCloudExporter: handlers for T/M/L (Tempo/Loki/Mimir) - production debugging
- JsonExporter: handlers for T/M/L/S/F (console output) - local development
- Validate Exported type serialization works correctly

**Note:** These exporters consume Exported types from the event bus, validating the type architecture established in Phase 1.

---

## Package Change Strategy

| PR | Package | Scope | File |
|----|---------|-------|------|
| PR 2.1 | `observability/grafana-cloud` (new) | GrafanaCloudExporter for T/M/L | [pr-2.1-grafana-cloud.md](./pr-2.1-grafana-cloud.md) |
| PR 2.2 | `observability/mastra` | JsonExporter for T/M/L/S/F | [pr-2.2-json-exporter.md](./pr-2.2-json-exporter.md) |

---

## Dependencies Between PRs

PR 2.1 and PR 2.2 can be done in parallel after Phase 1 is complete.

```
Phase 1 complete
    ↓
PR 2.1 (GrafanaCloud)  ← can run in parallel
PR 2.2 (JsonExporter)  ← can run in parallel
```

---

## Definition of Done

- [ ] GrafanaCloudExporter package created and working (T/M/L)
- [ ] JsonExporter outputs T/M/L/S/F events
- [ ] Exported types serialize correctly (validated)
- [ ] `RecordedTrace.fromJSON()` / `RecordedTrace.fromSpans()` factory methods
- [ ] Documentation for GrafanaCloudExporter config
- [ ] Tests passing

---

## JSON → RecordedTrace Conversion

The JsonExporter outputs serialized span data. To support round-tripping (and testing), Phase 2 includes factory methods to reconstruct a `RecordedTrace` from JSON or span data:

```typescript
// From JSON string (e.g., JsonExporter output)
const trace = RecordedTrace.fromJSON(jsonString, observabilityBus);

// From already-parsed span data array
const trace = RecordedTrace.fromSpans(spanDataArray, observabilityBus);
```

**Implementation approach:**
1. Parse JSON to `SpanData[]` array
2. Build lookup map: `spanId → RecordedSpan`
3. Wire up parent/children references using `parentSpanId`
4. Find root span (no parent)
5. Return `RecordedTrace` with tree access (rootSpan) and flat access (spans array)

**Use cases:**
- Testing: Create traces from JSON fixtures
- Debugging: Load traces from JsonExporter output
- Import: Cross-system trace transfer

---

## Notes

- This phase validates the Exported type architecture from Phase 1
- GrafanaCloudExporter provides production debugging visibility
- JsonExporter provides local development debugging
- Can start using GrafanaCloudExporter immediately with Grafana Cloud free tier
- JSON → RecordedTrace conversion enables testing and debugging workflows
