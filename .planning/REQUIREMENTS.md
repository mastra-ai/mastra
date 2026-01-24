# Requirements: Mastra Datasets

## v1 Requirements

### Storage & Data Layer

**STORE-01: Dataset CRUD**
User can create, read, update, delete datasets with name, description, and metadata.

**STORE-02: Dataset Items Structure**
Items contain input (any JSON), optional expectedOutput (any JSON), and optional context metadata.

**STORE-03: New Storage Domain**
DatasetsStorage domain follows existing storage pattern (workflows, memory, scores) with pluggable backends.

**STORE-04: Run Records**
Runs persist with targetType, targetId, version snapshot, status, and timestamps.

**VERS-01: Auto-Versioning**
Dataset version auto-increments on any item change (add, update, delete).

### Execution Layer

**EXEC-01: Run Against Targets**
Run datasets against targets (agents, workflows, scorers, processors) with concurrent execution.

**EXEC-02: Apply Scorers**
Apply scorer functions to run results, separate from target's built-in scorers.

**EXEC-03: Run Status Tracking**
Track run lifecycle: pending → running → completed/failed.

**SCORE-01: Score Storage**
Store scores in existing ScoresStorage, linked to run results.

### Target Integration

**TARGET-01: Workflow Target**
Run dataset against workflow with input mapping (exact match for v1: item.input must match workflow schema).

**TARGET-02: Agent Target**
Run dataset against agent via Agent.generate(), respecting request context.

**TARGET-03: Scorer Target**
Run dataset against scorer to test scoring logic in isolation.

**TARGET-04: Processor Target**
Run dataset against processor to test data transformations.

### Analysis Layer

**COMP-01: Run Comparison**
Compare two runs side-by-side with per-item and aggregate score deltas.

**COMP-02: Cross-Version Comparison**
Allow comparison across dataset versions with clear warnings when item sets differ.

**ANAL-01: Success Rate**
Calculate percentage of items without errors per run.

**ANAL-02: Score Aggregates**
Compute average scores and score distributions per run.

**ANAL-03: Latency Distribution**
Track latency distribution (p50, p95, p99) per run.

### UI Integration

**UI-01: Datasets Page**
Playground page for listing, creating, and managing datasets (sidebar integration).

**UI-02: Dataset Detail Page**
Show items list and run history for a dataset.

**UI-03: Run Triggering**
UI flow for selecting target, scorers, and triggering run.

**UI-04: Results View**
Display per-item outputs, scores, and run analytics.

### Bulk Operations

**CSV-01: Bulk Import**
Import test cases from CSV with input/expectedOutput columns.

**CSV-02: CSV Validation**
Validate CSV structure and report row-level errors before import.

**SEL-01: Item Selection**
Run subset of dataset via itemIds[] parameter for quick iteration.

## v2 Requirements (Deferred)

**SCHEMA-01: JSON Schema Validation** (P4)
Optional JSON Schema validation for input/expectedOutput fields.

**VIRT-01: Virtual Folders** (P4)
Slash notation organization for datasets (e.g., "agents/chatbot/edge-cases").

**SAVED-01: Saved Subsets** (Deferred)
Named item selections for reuse across runs.

**STAT-01: Statistical Significance** (Deferred)
Calculate statistical significance on score deltas between runs.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| STORE-01 | Phase 1 | Pending |
| STORE-02 | Phase 1 | Pending |
| STORE-03 | Phase 1 | Pending |
| STORE-04 | Phase 1 | Pending |
| VERS-01 | Phase 1 | Pending |
| EXEC-01 | Phase 2 | Pending |
| EXEC-02 | Phase 2 | Pending |
| EXEC-03 | Phase 2 | Pending |
| SCORE-01 | Phase 2 | Pending |
| TARGET-01 | Phase 3 | Pending |
| TARGET-02 | Phase 3 | Pending |
| TARGET-03 | Phase 4 | Pending |
| TARGET-04 | Phase 4 | Pending |
| COMP-01 | Phase 5 | Pending |
| COMP-02 | Phase 5 | Pending |
| ANAL-01 | Phase 5 | Pending |
| ANAL-02 | Phase 5 | Pending |
| ANAL-03 | Phase 5 | Pending |
| UI-01 | Phase 6 | Pending |
| UI-02 | Phase 6 | Pending |
| UI-03 | Phase 6 | Pending |
| UI-04 | Phase 6 | Pending |
| CSV-01 | Phase 7 | Pending |
| CSV-02 | Phase 7 | Pending |
| SEL-01 | Phase 8 | Pending |

**Coverage:** 24/24 v1 requirements mapped ✓
