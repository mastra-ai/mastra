# Architecture Research: AI Evaluation Dataset Systems

## Summary

Evaluation dataset systems follow a three-tier architecture: **Data Layer** (datasets, items, versions), **Execution Layer** (runs, results, scoring), **Presentation Layer** (comparison, analysis). Mastra's existing patterns (storage domains, scorers, request context) map directly to this model.

---

## Industry Patterns

### Langfuse Datasets

**Data Model:**
- Dataset: named collection with metadata
- DatasetItem: input + optional expected output (ground truth)
- DatasetRun: execution against a target, links to items
- DatasetRunItem: individual result per item

**Key Pattern:** Items are immutable after creation. New items create implicit "version" via timestamp.

**Scoring:** Integrates with their existing trace/score system. Scores attach to individual run items.

### Braintrust

**Data Model:**
- Dataset: versioned collection (explicit versioning)
- Record: input/expected with metadata
- Experiment: a run with specific config
- ExperimentResult: results with scores

**Key Pattern:** Explicit versioning with diff capability. Can compare experiments across dataset versions.

**Scoring:** Scorer functions passed to experiment, not stored on dataset.

### LangSmith

**Data Model:**
- Dataset: collection with schema
- Example: input/output pair with metadata
- ExperimentRun: execution record
- RunResult: per-example result

**Key Pattern:** Strong typing via schemas. Examples can have multiple valid outputs.

**Scoring:** Evaluators (scorers) specified per experiment run.

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Dataset UI  │  │  Run UI     │  │ Comparison/Analysis UI  │ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                       API LAYER                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────┐   │
│  │ Datasets API  │  │   Runs API    │  │  Comparison API   │   │
│  └───────┬───────┘  └───────┬───────┘  └─────────┬─────────┘   │
└──────────┼──────────────────┼────────────────────┼─────────────┘
           │                  │                    │
           ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     EXECUTION LAYER                              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Run Executor                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │   │
│  │  │ Item Runner │  │  Scorer     │  │ Result Collector │ │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐   │
│  │   Target    │  │              Existing Mastra            │   │
│  │  Adapter    │◀─┤   Agent.generate() / Workflow.run()     │   │
│  └─────────────┘  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                DatasetsStorage (New Domain)              │   │
│  │  ┌──────────┐  ┌────────────┐  ┌────────┐  ┌─────────┐ │   │
│  │  │ Datasets │  │   Items    │  │  Runs  │  │ Results │ │   │
│  │  └──────────┘  └────────────┘  └────────┘  └─────────┘ │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        Existing: MastraCompositeStore                    │   │
│  │   (pg, libsql, etc. — pluggable backends)                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Creating a Dataset

```
User Input → Datasets API → DatasetsStorage.createDataset() → DB
                ↓
           Version 1 created (implicit)
```

### Adding Items

```
User Input → Datasets API → DatasetsStorage.createDatasetItem()
                ↓
           Auto-increment dataset version
                ↓
           Store item with version reference
```

### Running a Dataset

```
Request (datasetId, targetId, scorerIds[])
    │
    ▼
Datasets API
    │
    ├─→ Load dataset items (specific version)
    │
    ├─→ Create Run record (status: running)
    │
    └─→ Run Executor
            │
            ├─→ For each item:
            │      │
            │      ├─→ Target Adapter (Agent/Workflow)
            │      │      │
            │      │      └─→ Generate output
            │      │
            │      ├─→ Store RunResult (output, latency)
            │      │
            │      └─→ For each scorer:
            │             │
            │             └─→ Score result → Store Score
            │
            └─→ Update Run (status: completed)
```

### Comparing Runs

```
Request (runId1, runId2)
    │
    ▼
Comparison API
    │
    ├─→ Load Run1 results + scores
    ├─→ Load Run2 results + scores
    │
    └─→ Compute deltas
            │
            ├─→ Per-item comparison (if same items)
            ├─→ Aggregate score comparison
            └─→ Version difference warnings
```

---

## Component Boundaries

### DatasetsStorage (New Storage Domain)

**Owns:**
- Dataset metadata (id, name, description, createdAt)
- Dataset versions (auto-incremented)
- DatasetItem records (input, expectedOutput, metadata, version)
- DatasetRun records (targetType, targetId, version, status)
- DatasetRunResult records (itemId, output, latency, metadata)

**Does NOT Own:**
- Score records (use existing ScoresStorage)
- Agent/Workflow execution (use existing primitives)

### Run Executor (Core Package)

**Owns:**
- Orchestrating item execution
- Calling scorers on results
- Managing run lifecycle (running → completed/failed)
- Progress reporting

**Does NOT Own:**
- Storage operations (delegates to DatasetsStorage)
- Actual execution (delegates to Agent/Workflow)
- Scoring logic (delegates to Scorers)

### Target Adapter

**Owns:**
- Normalizing input format for different targets
- Extracting output from target response
- Handling streaming vs. non-streaming

**Does NOT Own:**
- Target implementation (uses existing)
- Result storage

### Datasets API (Server Package)

**Owns:**
- HTTP routes for CRUD operations
- Request validation (Zod schemas)
- Auth enforcement via existing patterns

**Does NOT Own:**
- Business logic (delegates to executor)
- Direct storage access (uses DatasetsStorage)

---

## Mastra Integration Points

### Storage Layer

```typescript
// packages/core/src/storage/base.ts
export type StorageDomains = {
  workflows: WorkflowsStorage;
  scores: ScoresStorage;
  memory: MemoryStorage;
  observability?: ObservabilityStorage;
  agents?: AgentsStorage;
  datasets?: DatasetsStorage;  // NEW
};
```

### Mastra Class

```typescript
// packages/core/src/mastra/index.ts
interface Config {
  // ... existing
  datasets?: DatasetsConfig;  // NEW
}

class Mastra {
  // ... existing
  getDatasets(): DatasetsStorage;
  runDataset(options: RunDatasetOptions): Promise<DatasetRun>;
}
```

### Server Routes

```typescript
// packages/server/src/server/handlers/datasets.ts
// New file following scores.ts pattern

export const LIST_DATASETS_ROUTE = createRoute({ ... });
export const CREATE_DATASET_ROUTE = createRoute({ ... });
export const RUN_DATASET_ROUTE = createRoute({ ... });
// etc.
```

### Scorer Reuse

```typescript
// Existing scorer interface works as-is
const result = await scorer.run({
  input: datasetItem.input,
  output: targetOutput,
  groundTruth: datasetItem.expectedOutput,
});
```

---

## Build Order

### Phase 1: Data Layer Foundation

1. **DatasetsStorage base class** — abstract interface
2. **Dataset types/schemas** — Zod schemas for all entities
3. **InMemory implementation** — for testing
4. **PostgreSQL implementation** — following pg store pattern

Dependencies: None (new domain)

### Phase 2: API Layer

5. **Datasets API routes** — CRUD for datasets and items
6. **Server integration** — register routes in route index

Dependencies: Phase 1

### Phase 3: Execution Layer

7. **Run Executor** — core orchestration
8. **Target Adapter** — agent/workflow abstraction
9. **Run API routes** — trigger runs, get status/results

Dependencies: Phases 1, 2

### Phase 4: Comparison & Analysis

10. **Comparison logic** — diff runs, aggregate scores
11. **Comparison API** — expose via routes
12. **Cross-version comparison** — handle item changes

Dependencies: Phase 3

### Phase 5: UI Integration

13. **Playground datasets page** — list, create, manage
14. **Dataset detail page** — items, runs list
15. **Run results page** — results table, scores
16. **Comparison view** — side-by-side diff

Dependencies: Phases 1-4 (API must exist)

### Phase 6: CI/Bulk Operations

17. **CLI command** — `mastra datasets run`
18. **CSV import** — bulk item creation
19. **Export** — results to CSV/JSON

Dependencies: Phases 1-3

---

## Key Decisions for Mastra

| Decision | Rationale |
|----------|-----------|
| **New storage domain** | Follows existing pattern, clear ownership |
| **Auto-versioning on item change** | Simpler than explicit version management for v1 |
| **Scorers passed per-run** | Matches Braintrust/LangSmith, more flexible |
| **Reuse existing ScoresStorage** | Scores are scores — don't duplicate |
| **Run executor in core** | Can be used programmatically and via server |
| **Target adapter pattern** | Abstract agent vs workflow differences |

---

## Quality Gate Checklist

- [x] Components clearly defined with boundaries
- [x] Data flow direction explicit
- [x] Build order implications noted

---

*Generated: 2026-01-23*
