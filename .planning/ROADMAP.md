# Roadmap: Mastra Datasets

## Overview

Systematic evaluation infrastructure for Mastra agents and workflows. Build from data layer foundation (datasets storage domain) through execution engine (run orchestration with scoring) to analysis capabilities (run comparison and analytics). Leverage existing storage patterns, scorer system, and playground UI to deliver regression detection in both development and CI environments.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Storage Foundation** - Datasets domain with CRUD and versioning
- [ ] **Phase 2: Execution Core** - Run orchestration against targets with auto-scoring
- [ ] **Phase 3: Agent & Workflow Targets** - Complete target adapters for agents and workflows
- [ ] **Phase 4: Scorer & Processor Targets** - Extend targets to scorers and processors
- [ ] **Phase 5: Run Analytics** - Cross-run comparison and score regression detection
- [ ] **Phase 6: Playground Integration** - Datasets UI with run triggering and results
- [ ] **Phase 7: CSV Import** - Bulk item creation from CSV files
- [ ] **Phase 8: Item Selection** - Run subsets via itemIds parameter

## Phase Details

### Phase 1: Storage Foundation
**Goal**: Dataset CRUD operations with auto-versioning on item changes
**Depends on**: Nothing (first phase)
**Requirements**: STORE-01 (Dataset CRUD), STORE-02 (Items structure), VERS-01 (Auto-versioning), STORE-03 (Storage domain)
**Success Criteria** (what must be TRUE):
  1. User can create dataset with name, description, metadata
  2. User can add items with input, expectedOutput, context (any JSON)
  3. Dataset version increments automatically when items are added/modified
  4. Items are queryable by dataset and version
  5. Storage works with libsql and in-memory backends (pg deferred)
**Plans**: TBD

Plans:
- [ ] 01-01: TBD

### Phase 2: Execution Core
**Goal**: Run datasets against targets with automatic scoring and result persistence
**Depends on**: Phase 1
**Requirements**: EXEC-01 (Run against targets), EXEC-02 (Apply scorers), EXEC-03 (Run status), STORE-04 (Run records), SCORE-01 (Score storage)
**Success Criteria** (what must be TRUE):
  1. User can trigger run with datasetId + targetId + optional scorerIds[]
  2. Run record stores targetId and targetType (agent/workflow/scorer/processor) for traceability
  3. Run executes each dataset item against target and stores output
  4. Scorers are applied to results and scores persist to ScoresStorage
  5. Run status tracks pending/running/completed/failed states
  6. Run results include output, latency, error info per item
**Plans**: TBD

Plans:
- [ ] 02-01: TBD

### Phase 3: Agent & Workflow Targets
**Goal**: Complete integration with Agent.generate() and Workflow.run()
**Depends on**: Phase 2
**Requirements**: TARGET-01 (Workflow target), TARGET-02 (Agent target)
**Success Criteria** (what must be TRUE):
  1. User can run dataset against workflow by passing workflowId
  2. Workflow input mapping works (item.input must match workflow schema for v1)
  3. User can run dataset against agent by passing agentId
  4. Agent execution respects request context (auth, threading)
  5. Both streaming and non-streaming targets work correctly
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Scorer & Processor Targets
**Goal**: Enable scoring scorers and processors in isolation
**Depends on**: Phase 3
**Requirements**: TARGET-03 (Scorer target), TARGET-04 (Processor target)
**Success Criteria** (what must be TRUE):
  1. User can run dataset against scorer to test scoring logic
  2. User can run dataset against processor to test data transformations
  3. Target adapter normalizes input for scorer/processor execution
  4. Results capture scorer outputs and processor transformations
**Plans**: TBD

Plans:
- [ ] 04-01: TBD

### Phase 5: Run Analytics
**Goal**: Compare runs to detect score regressions and track performance
**Depends on**: Phase 2
**Requirements**: COMP-01 (Run comparison), COMP-02 (Cross-version comparison), ANAL-01 (Success rate), ANAL-02 (Score aggregates), ANAL-03 (Latency distribution)
**Success Criteria** (what must be TRUE):
  1. User can compare two runs side-by-side with score deltas
  2. Comparison warns when dataset versions differ between runs
  3. Analytics show success rate (% items without errors)
  4. Analytics show average scores and score distributions
  5. Analytics show latency distribution (p50, p95, p99)
**Plans**: TBD

Plans:
- [ ] 05-01: TBD

### Phase 6: Playground Integration
**Goal**: Full UI workflow from dataset creation through result review
**Depends on**: Phases 1, 2, 5
**Requirements**: UI-01 (Datasets page), UI-02 (Detail page), UI-03 (Run triggering), UI-04 (Results view)
**Success Criteria** (what must be TRUE):
  1. User can create/edit/delete datasets from sidebar in playground
  2. Dataset detail page shows items list and run history
  3. User can trigger run by selecting target and scorers
  4. Results view displays per-item outputs and scores
  5. Comparison view shows score deltas between two runs
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: CSV Import
**Goal**: Bulk item creation from CSV with validation and explicit column mapping
**Depends on**: Phase 1
**Requirements**: CSV-01 (Bulk import), CSV-02 (Validation)
**Success Criteria** (what must be TRUE):
  1. User can upload CSV file with any column names
  2. User explicitly maps CSV columns to dataset fields (input, expectedOutput, metadata)
  3. Import validates mapped data before committing
  4. Invalid rows are reported with line numbers and error messages
  5. Successful import auto-increments dataset version
  6. Import works from both CLI and playground UI
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

### Phase 8: Item Selection
**Goal**: Run subsets of dataset for quick iteration via UI selection
**Depends on**: Phase 2, Phase 6
**Requirements**: SEL-01 (Item selection)
**Success Criteria** (what must be TRUE):
  1. User can select specific items via checkboxes in dataset detail UI
  2. Selection count shown (e.g., "5 of 100 selected")
  3. "Run Selected" button triggers run with only selected itemIds[]
  4. Run record stores which items were included
  5. Analytics compute correctly for partial runs
  6. Comparison works between full and partial runs with clear indication
**Plans**: TBD

Plans:
- [ ] 08-01: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Storage Foundation | 0/TBD | Not started | - |
| 2. Execution Core | 0/TBD | Not started | - |
| 3. Agent & Workflow Targets | 0/TBD | Not started | - |
| 4. Scorer & Processor Targets | 0/TBD | Not started | - |
| 5. Run Analytics | 0/TBD | Not started | - |
| 6. Playground Integration | 0/TBD | Not started | - |
| 7. CSV Import | 0/TBD | Not started | - |
| 8. Item Selection | 0/TBD | Not started | - |
