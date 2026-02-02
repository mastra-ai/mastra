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
- [x] **Phase 5: Run Analytics** - Cross-run comparison and score regression detection ✓
- [x] **Phase 6: Playground Integration** - Datasets UI with run triggering and results ✓
- [x] **Phase 7: CSV Import** - Bulk item creation from CSV files ✓
- [x] **Phase 8: Item Selection & Actions** - Bulk operations via item selection ✓
- [x] **Phase 9: Dataset Items Detail View** - EntryList with SideDialog, edit/delete flows ✓
- [x] **Phase 10: Dataset Layout Update** - Master-detail layout with inline item viewing ✓
- [x] **Phase 11: Dataset Schema Validation** - Input/output schema enforcement with import validation ✓

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

- [x] 05-01-PLAN.md — Run comparison and analytics with regression detection

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
   **Plans**: 12 plans (6 initial + 6 UAT fixes)

Plans:

- [x] 06-01-PLAN.md — Server API routes for datasets, runs, and comparison
- [x] 06-02-PLAN.md — Client-js methods for dataset operations
- [x] 06-03-PLAN.md — Playground-ui hooks for data fetching and mutations
- [x] 06-04-PLAN.md — Datasets list page with table and create dialog
- [x] 06-05-PLAN.md — Dataset detail page with items, runs, and trigger dialog
- [x] 06-06-PLAN.md — Results view and comparison UI
- [x] 06-07-PLAN.md — UI fixes: dataset/item edit/delete, add item button (UAT 11,12,13)
- [x] 06-08-PLAN.md — Async run trigger (UAT 14)
- [x] 06-09-PLAN.md — Scores display in results (UAT 15)
- [x] 06-10-PLAN.md — Trace links in results (UAT 16)
- [x] 06-11-PLAN.md — Gap closure: traceId schema + results auto-refresh
- [x] 06-12-PLAN.md — Gap closure: embed scores in results + fix trace link

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
6. Import works from playground UI (CLI deferred)
   **Plans**: 5 plans

Plans:

- [x] 07-01-PLAN.md — PapaParse installation + CSV parsing/validation utilities
- [x] 07-02-PLAN.md — Drag-drop column mapping component with state hook
- [x] 07-03-PLAN.md — Multi-step CSV import dialog (upload → preview → map → validate → import)
- [x] 07-04-PLAN.md — Integration into dataset detail page items list
- [x] 07-05-PLAN.md — Gap closure: fix useColumnMapping headers sync

### Phase 8: Item Selection & Actions

**Goal**: Bulk operations on dataset items via selection UI
**Depends on**: Phase 6
**Requirements**: SEL-01 (Item selection), ACT-01 (Export CSV), ACT-02 (Create dataset), ACT-03 (Delete items)
**Success Criteria** (what must be TRUE):

1. User can select items via checkboxes (single click, shift-click range, select all)
2. ⋮ menu appears when dataset has ≥1 item with action options
3. Export to CSV downloads selected items immediately
4. Create Dataset opens modal, creates new dataset from selected items
5. Delete Items shows confirmation, removes selected items
6. Selection mode exits after action completes with success banner
   **Plans**: 4 plans

Plans:

- [x] 08-01-PLAN.md — Selection state hook + CSV export utility
- [x] 08-02-PLAN.md — Three-dot menu component + bulk delete mutation
- [x] 08-03-PLAN.md — Create dataset from items dialog
- [x] 08-04-PLAN.md — Integration into ItemsList and DatasetDetail

### Phase 9: Dataset Items Detail View

**Goal**: Enhanced item viewing with SideDialog, navigation, inline edit, and delete confirmation
**Depends on**: Phase 6
**Requirements**: UI-05 (EntryList pattern), UI-06 (SideDialog detail), UI-07 (Item edit mode), UI-08 (Delete confirmation)
**Success Criteria** (what must be TRUE):

1. Items list uses EntryList component (same pattern as Traces on Observability page)
2. Each item row displays input, expectedOutput, metadata, creation date (no action buttons)
3. Clicking item opens SideDialog with full item details
4. SideDialog has prev/next navigation (same pattern as Trace details)
5. Edit button switches to editable form, Save/Cancel at bottom
6. Delete button shows confirmation modal, success closes dialog with Toast
   **Plans**: 5 plans

Plans:

- [x] 09-01-PLAN.md — EntryList conversion for ItemsList
- [x] 09-02-PLAN.md — ItemDetailDialog with SideDialog and navigation
- [x] 09-03-PLAN.md — Inline edit mode with CodeEditor fields
- [x] 09-04-PLAN.md — Delete confirmation with AlertDialog
- [x] 09-05-PLAN.md — Integration into DatasetDetail page

### Phase 10: Dataset Layout Update

**Goal**: Master-detail layout with inline item viewing, reorganized header/toolbar, and split button components
**Depends on**: Phase 9
**Requirements**: None (UI/UX enhancement phase)
**Success Criteria** (what must be TRUE):

1. Header shows dataset name/description with three-dot menu (Edit, Duplicate disabled, Delete)
2. Items toolbar has split button for "New Item" with import dropdown
3. Clicking item opens inline detail panel (master-detail layout)
4. Container expands from 50rem to 100rem max-width when detail panel opens
5. Item detail panel has navigation + edit split button with delete/duplicate options
6. Each column scrolls independently

**Plans**: 5 plans

Plans:

- [x] 10-01-PLAN.md — SplitButton design system component
- [x] 10-02-PLAN.md — DatasetHeader with three-dot menu
- [x] 10-03-PLAN.md — ItemsToolbar with split button and reorganized actions
- [x] 10-04-PLAN.md — ItemDetailPanel and ItemDetailToolbar extraction
- [x] 10-05-PLAN.md — ItemsMasterDetail container and DatasetDetail integration

### Phase 11: Dataset Schema Validation

**Goal**: Input/output schema enforcement with validation on add and import
**Depends on**: Phase 10
**Requirements**: None (feature enhancement)
**Success Criteria** (what must be TRUE):

1. Users can enable/disable input and output schemas independently on a dataset
2. Users can import a schema from a workflow or agent, or define custom JSON Schema
3. Imported schemas are copied (not referenced) and can be modified
4. Adding an item validates against enabled schemas with field-level error messages
5. CSV import skips rows that fail validation and reports the count of failures
6. Enabling or modifying a schema on a dataset with existing items validates all items
7. If validation fails when enabling/modifying schema, up to 10 failing items are shown with errors
8. Users cannot enable or modify a schema if existing items would fail validation

**Plans**: 9 plans

Plans:

- [x] 11-01-PLAN.md — Core types and Ajv validation utilities
- [x] 11-02-PLAN.md — Storage layer schema validation (addItem/updateItem)
- [x] 11-03-PLAN.md — API routes for schema management and workflow schema extraction
- [x] 11-04-PLAN.md — CSV import validation with skip reporting
- [x] 11-05a-PLAN.md — Workflow schema hook and import component
- [x] 11-05b-PLAN.md — Schema field, settings dialog, and header integration
- [x] 11-06-PLAN.md — Validation error display in add/edit item and CSV import
- [x] 11-07-PLAN.md — End-to-end verification checkpoint
- [x] 11-08-PLAN.md — Schema source selector with auto-population (gap closure)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11

| Phase                         | Plans Complete | Status     | Completed  |
| ----------------------------- | -------------- | ---------- | ---------- |
| 1. Storage Foundation         | 4/4            | ✓ Complete | 2026-01-24 |
| 2. Execution Core             | 4/4            | ✓ Complete | 2026-01-24 |
| 3. Agent & Workflow Targets   | 1/1            | ✓ Complete | 2026-01-24 |
| 4. Scorer Targets             | 1/1            | ✓ Complete | 2026-01-24 |
| 5. Run Analytics              | 1/1            | ✓ Complete | 2026-01-24 |
| 6. Playground Integration     | 12/12          | ✓ Complete | 2026-01-26 |
| 7. CSV Import                 | 5/5            | ✓ Complete | 2026-01-27 |
| 8. Item Selection & Actions   | 4/4            | ✓ Complete | 2026-01-27 |
| 9. Dataset Items Detail View  | 5/5            | ✓ Complete | 2026-01-29 |
| 10. Dataset Layout Update     | 5/5            | ✓ Complete | 2026-01-30 |
| 11. Dataset Schema Validation | 9/9            | ✓ Complete | 2026-02-02 |
