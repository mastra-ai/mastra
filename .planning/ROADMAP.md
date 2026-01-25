# Roadmap: Mastra Datasets

## Overview

Systematic evaluation infrastructure for Mastra agents and workflows. Build from data layer foundation (datasets storage domain) through execution engine (run orchestration with scoring) to analysis capabilities (run comparison and analytics). Leverage existing storage patterns, scorer system, and playground UI to deliver regression detection in both development and CI environments.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Storage Foundation** - Datasets domain with CRUD and versioning ✓
- [x] **Phase 2: Execution Core** - Run orchestration against targets with auto-scoring ✓
- [x] **Phase 3: Agent & Workflow Targets** - Complete target adapters for agents and workflows ✓
- [x] **Phase 4: Scorer Targets** - Run datasets against scorers for LLM-as-judge alignment ✓
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
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — Types, schemas, and DatasetsStorage base class
- [x] 01-02-PLAN.md — DatasetsInMemory implementation and core registration
- [x] 01-03-PLAN.md — DatasetsLibSQL implementation
- [x] 01-04-PLAN.md — Test suite validating both backends

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
**Plans**: 4 plans

Plans:
- [x] 02-01-PLAN.md — RunsStorage types, schemas, and base class
- [x] 02-02-PLAN.md — RunsInMemory implementation and exports
- [x] 02-03-PLAN.md — Run orchestration with p-map execution and scoring
- [x] 02-04-PLAN.md — Test suite for RunsInMemory and runDataset

### Phase 3: Agent & Workflow Targets
**Goal**: Verify Agent.generate() and Workflow.run() integration handles all input variations
**Depends on**: Phase 2
**Requirements**: TARGET-01 (Workflow target), TARGET-02 (Agent target)
**Success Criteria** (what must be TRUE):
  1. User can run dataset against workflow by passing workflowId
  2. Workflow input mapping works (item.input must match workflow schema for v1)
  3. User can run dataset against agent by passing agentId
  4. Agent/workflow execution handles all statuses (success, failed, suspended, etc.)
  5. v1 limitations documented: context propagation deferred (per CONTEXT.md)
**Plans**: 1 plan

Plans:
- [x] 03-01-PLAN.md — Executor edge case tests for agent/workflow input variations

### Phase 4: Scorer Targets
**Goal**: Enable running datasets against scorers to calibrate/align LLM-as-judge evaluation
**Depends on**: Phase 3
**Requirements**: TARGET-03 (Scorer target)
**Success Criteria** (what must be TRUE):
  1. User can run dataset against scorer to test scoring logic alignment
  2. Dataset item provides input, output (thing being judged), expectedOutput (human label)
  3. Scorer receives input mapped to scorer.run({ input, output, groundTruth })
  4. Results store scorer output alongside human label for alignment analysis
  5. Optional meta-scorers can evaluate scorer output
**Plans**: 1 plan

Plans:
- [x] 04-01-PLAN.md — TDD executeScorer implementation with DatasetItem.output field

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
**Plans**: 1 plan

Plans:
- [ ] 05-01-PLAN.md — Run comparison and analytics with regression detection

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
| 1. Storage Foundation | 4/4 | ✓ Complete | 2026-01-24 |
| 2. Execution Core | 4/4 | ✓ Complete | 2026-01-24 |
| 3. Agent & Workflow Targets | 1/1 | ✓ Complete | 2026-01-24 |
| 4. Scorer Targets | 1/1 | ✓ Complete | 2026-01-24 |
| 5. Run Analytics | 0/TBD | Not started | - |
| 6. Playground Integration | 0/TBD | Not started | - |
| 7. CSV Import | 0/TBD | Not started | - |
| 8. Item Selection | 0/TBD | Not started | - |
