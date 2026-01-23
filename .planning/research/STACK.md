# Technology Stack Research: AI Evaluation Datasets

**Research Date:** 2026-01-23
**Domain:** Evaluation dataset implementations in AI frameworks

---

## Existing Mastra Stack to Leverage

### Storage Infrastructure

**Current Domains:**
- `WorkflowsStorage` — workflow runs and state
- `MemoryStorage` — conversation threads and messages
- `ScoresStorage` — evaluation scores from scorers
- `AgentsStorage` — agent metadata
- `ObservabilityStorage` — traces and spans

**Pattern:** Each domain has:
1. Base interface in `packages/core/src/storage/`
2. Implementations in `stores/` (pg, libsql, etc.)
3. Zod schemas for type safety
4. CRUD + query methods

**Implication:** Datasets needs its own `DatasetsStorage` domain following same pattern.

### Evals/Scorers System

**Location:** `packages/evals/`

**Key Types:**
```typescript
interface MastraScorer<TInput, TOutput, TGroundTruth, TResult> {
  id: string;
  name: string;
  type: 'agent' | 'workflow';
  run(params: { input; output; groundTruth; requestContext }): Promise<TResult>;
}
```

**Existing Scorers:**
- Toxicity, Bias, Hallucination, Coherence, Relevance, etc.
- Custom scorer support via `createScorer()`

**Implication:** Reuse scorer interface directly. Dataset runs select scorers, pass `input`/`output`/`groundTruth` from dataset items.

### Server Routes Pattern

**Location:** `packages/server/src/server/handlers/`

**Pattern Example (scores.ts):**
```typescript
export const LIST_SCORES_ROUTE = createRoute({
  method: 'GET',
  path: '/scores',
  responseType: 'json',
  queryParamSchema: listScoresQuerySchema,
  responseSchema: scoresWithPaginationResponseSchema,
  handler: async ({ mastra, ...params }) => { ... }
});
```

**Implication:** Follow same pattern for datasets routes.

### Playground UI Patterns

**Location:** `packages/playground-ui/`

**Key Components:**
- Sidebar navigation
- List views with pagination
- Detail panels
- Form modals

**Implication:** Datasets UI follows existing patterns.

---

## Technology Choices for Datasets

### Schema Definitions

**Tool:** Zod 3.x
**Reason:** Already used throughout Mastra for type-safe schema validation.

```typescript
// Example dataset schemas
export const datasetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  version: z.number().int().positive(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const datasetItemSchema = z.object({
  id: z.string().uuid(),
  datasetId: z.string().uuid(),
  version: z.number().int().positive(),
  input: z.unknown(),  // Any JSON
  expectedOutput: z.unknown().optional(),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.date(),
});
```

### Storage Implementation

**Primary:** PostgreSQL (via existing pg store pattern)
**Secondary:** LibSQL (for lighter deployments)

**Tables Needed:**
```sql
datasets (id, name, description, version, created_at, updated_at)
dataset_items (id, dataset_id, version, input, expected_output, metadata, created_at)
dataset_runs (id, dataset_id, dataset_version, target_type, target_id, status, created_at, completed_at)
dataset_run_results (id, run_id, item_id, output, latency_ms, metadata, created_at)
```

**Scores:** Use existing `scores` table, link via `entity_id` = `run_result_id`.

### API Layer

**Framework:** Hono (existing)
**Validation:** Zod schemas for request/response
**Auth:** Existing request context pattern

### Run Execution

**Concurrency:** Use existing `p-map` for parallel item execution
**Progress:** Use existing event streaming pattern (WorkflowRunOutput)
**Rate Limiting:** Configurable concurrency per run

### CSV Import

**Library:** Papa Parse (lightweight, well-tested)
**Pattern:** Stream parse for large files, validate before commit

---

## Integration Points

### With Existing Storage

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

### With Existing Scorers

```typescript
// Run executor calls scorers same way evals package does
const scoreResult = await scorer.run({
  input: item.input,
  output: targetOutput,
  groundTruth: item.expectedOutput,
  requestContext: runContext,
});
```

### With Existing Server

```typescript
// packages/server/src/server/index.ts
import { datasetRoutes } from './handlers/datasets';
// Register routes same as others
```

### With Existing Playground

```typescript
// packages/playground-ui/src/components/Sidebar.tsx
// Add "Datasets" nav item
// packages/playground-ui/src/pages/datasets/
// New page components
```

---

## Dependencies to Add

### Core Package

```json
{
  "dependencies": {
    // None new — reuse existing p-map, zod, etc.
  }
}
```

### Server Package

```json
{
  "dependencies": {
    // None new — uses hono, zod already
  }
}
```

### CLI Package

```json
{
  "dependencies": {
    "papaparse": "^5.4.1"  // CSV parsing
  }
}
```

### Playground UI

```json
{
  "dependencies": {
    // None new — uses existing React, TailwindCSS
  }
}
```

---

## Build Considerations

### Type Generation

- Zod schemas generate TypeScript types
- Export types from `packages/core/src/datasets/types.ts`
- Use in server handlers and UI

### Testing Strategy

- Unit tests for DatasetsStorage interface
- Integration tests with pg/libsql
- E2E tests for run execution flow
- Mock scorers for consistent test behavior

### Migration Path

- New storage domain = no migration needed
- Tables created on first access (same as other domains)
- No breaking changes to existing APIs

---

## Quality Gate Checklist

- [x] Libraries compatible with existing stack
- [x] No conflicting versions
- [x] Clear integration strategy with existing components

---

*Research based on: Mastra codebase analysis (packages/core, packages/server, packages/evals, stores/)*
*Last updated: 2026-01-23*
