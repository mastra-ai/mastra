# Phase 2: Debug Exporters

**Status:** PARTIALLY DONE
**Prerequisites:** Phase 1 (Foundation) ✅
**Scope:** Debug exporters for development and production visibility

---

## Overview

Phase 2 builds exporters for ALL signals early to validate interfaces and provide developer visibility.

**What was completed:**
- TestExporter (renamed from "JsonExporter"): handles T/M/L/S/F — collects events in memory for testing

**What changed from the original plan:**
- **JsonExporter → TestExporter rename:** The exporter collects events in memory arrays for testing assertions. It doesn't actually export JSON, so it was renamed to TestExporter to better reflect its purpose.
- **GrafanaCloudExporter: POSTPONED** — will be revisited later.
- **RecordedTrace round-trip from JSON: CANCELED** — RecordedTrace will be built from storage instead, which is the natural path once Phase 6 (storage) is implemented.

---

## Package Change Strategy

| PR | Package | Scope | Status |
|----|---------|-------|--------|
| PR 2.1 | `observability/grafana-cloud` (new) | GrafanaCloudExporter for T/M/L | **Postponed** |
| PR 2.2 | `observability/mastra` | TestExporter for T/M/L/S/F | **Done** |

---

## Definition of Done

- [ ] ~~GrafanaCloudExporter package created and working (T/M/L)~~ **Postponed**
- [x] TestExporter collects T/M/L/S/F events _(renamed from JsonExporter)_
- [x] Exported types serialize correctly (validated)
- [ ] ~~`RecordedTrace.fromJSON()` / `RecordedTrace.fromSpans()` factory methods~~ **Canceled** — RecordedTrace will be built from storage
- [ ] ~~Documentation for GrafanaCloudExporter config~~ **Postponed**
- [x] Tests passing

---

## Notes

- TestExporter is the primary tool for testing the full observability pipeline
- RecordedTrace construction will happen from storage (Phase 6) rather than JSON round-tripping
- GrafanaCloudExporter can be revisited once the core pipeline is stable
