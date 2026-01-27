# Requirements: Evented Workflow Runtime v1.1

**Defined:** 2026-01-27
**Core Value:** Evented runtime passes the same test suite as default runtime

## v1.1 Requirements

Requirements for agent integration and foreach control parity.

### Agent Integration

- [x] **AGENT-01**: Agent steps support V2+ models via specificationVersion branching
- [x] **AGENT-02**: Agent steps use .stream() for V2+ models instead of .streamLegacy()
- [x] **AGENT-03**: TripWire errors caught and serialized with explicit type markers
- [x] **AGENT-04**: TripWire status propagates from agent to workflow result
- [ ] **AGENT-05**: Writer API exposed in step context as ToolStream instance
- [ ] **AGENT-06**: Writer .write() method emits custom chunks during step execution
- [ ] **AGENT-07**: Writer .custom() method emits typed custom events

### Foreach Control

- [ ] **FOREACH-01**: Resume API accepts forEachIndex parameter
- [ ] **FOREACH-02**: forEachIndex targets specific iteration on resume
- [ ] **FOREACH-03**: forEachIndex stored in __workflow_meta on suspend

## Future Requirements

Deferred to later milestones.

### Architecture Evolution (v2.0)

- **ARCH-01**: Parallel suspend handles multiple suspends in single parallel block
- **ARCH-02**: Branch execution runs all matching conditions (not just first)
- **ARCH-03**: Time travel replay for debugging

## Out of Scope

Explicitly excluded from v1.1.

| Feature | Reason |
|---------|--------|
| Parallel suspend | Architectural change, defer to v2.0 |
| Branch all-match execution | Architectural change, defer to v2.0 |
| Performance optimization | Correctness first, optimize later |
| New features beyond default runtime | Parity only, no additions |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGENT-01 | Phase 7 | Complete |
| AGENT-02 | Phase 7 | Complete |
| AGENT-03 | Phase 7 | Complete |
| AGENT-04 | Phase 7 | Complete |
| AGENT-05 | Phase 8 | Pending |
| AGENT-06 | Phase 8 | Pending |
| AGENT-07 | Phase 8 | Pending |
| FOREACH-01 | Phase 9 | Pending |
| FOREACH-02 | Phase 9 | Pending |
| FOREACH-03 | Phase 9 | Pending |

**Coverage:**
- v1.1 requirements: 10 total
- Mapped to phases: 10 (100%)
- Unmapped: 0

**Phase breakdown:**
- Phase 7 (V2 Model + TripWire): 4 requirements
- Phase 8 (Writer API): 3 requirements
- Phase 9 (Foreach Index Resume): 3 requirements

---
*Requirements defined: 2026-01-27*
*Last updated: 2026-01-27 after Phase 7 completion*
