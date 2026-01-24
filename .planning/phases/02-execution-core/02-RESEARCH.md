# Phase 2: Execution Core - Research

**Researched:** 2026-01-24
**Domain:** Dataset Run Execution with Concurrent Target Invocation and Scoring
**Confidence:** HIGH

## Summary

Researched Mastra's existing execution patterns for running evaluations against targets. The codebase already has `runEvals()` in `packages/core/src/evals/run/index.ts` which executes datasets against agents/workflows with concurrent scoring using p-map. This is the primary pattern to follow.

Phase 2 builds on Phase 1's DatasetsStorage (already implemented with InMemory and LibSQL backends). The execution layer needs: (1) a new RunsStorage domain for tracking run state, (2) the run orchestration logic that loads items, executes against targets, applies scorers, and persists results, (3) integration with existing ScoresStorage for score persistence.

**Primary recommendation:** Follow the existing `runEvals()` pattern with these modifications: add RunsStorage domain for run tracking, support async mode via polling, and integrate with Phase 1's DatasetsStorage for loading items by version.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| p-map | ^7.x | Concurrent execution | Already used in runEvals, hooks, scoreTracesWorkflow |
| @mastra/core | internal | Storage domains, Agent, Workflow | Existing patterns |
| zod | ^3.x | Schema validation | Already used throughout |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto | built-in | UUID generation | `crypto.randomUUID()` for runIds |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| p-map | Promise.all with chunking | p-map handles backpressure, errors better |
| Custom status polling | WebSocket/SSE | Polling simpler for v1, matches Braintrust |

**Installation:**
```bash
# p-map already in dependencies, no new packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/
├── storage/
│   ├── domains/
│   │   └── runs/
│   │       ├── base.ts           # RunsStorage abstract class
│   │       ├── inmemory.ts       # RunsInMemory implementation
│   │       └── index.ts          # Re-exports
│   ├── constants.ts              # Add TABLE_RUNS, RUNS_SCHEMA
│   └── types.ts                  # Add Run types
├── datasets/
│   ├── run/
│   │   ├── index.ts              # Main run() function
│   │   ├── types.ts              # RunConfig, RunResult types
│   │   ├── executor.ts           # Target execution helpers
│   │   └── scorer.ts             # Scoring helpers
│   └── index.ts                  # mastra.datasets.run() entry
└── mastra/
    └── index.ts                  # Add datasets.run() method
```

### Pattern 1: Concurrent Execution with p-map
**What:** Run items concurrently with controlled concurrency
**When to use:** All batch execution against targets
**Example:**
```typescript
// Source: packages/core/src/evals/run/index.ts
import pMap from 'p-map';

const results = await pMap(
  items,
  async (item) => {
    const targetResult = await executeTarget(target, item);
    const scorerResults = await runScorers(scorers, targetResult, item);
    return { item, targetResult, scorerResults };
  },
  { concurrency: config.maxConcurrency ?? 5 }
);
```

### Pattern 2: Target Resolution via Mastra Registries
**What:** Resolve targetId to Agent/Workflow instance using mastra.getAgent/getWorkflow
**When to use:** When caller provides string IDs instead of instances
**Example:**
```typescript
// Source: packages/core/src/mastra/index.ts pattern
function resolveTarget(mastra: Mastra, targetType: TargetType, targetId: string) {
  switch (targetType) {
    case 'agent':
      return mastra.getAgentById(targetId) ?? mastra.getAgent(targetId);
    case 'workflow':
      return mastra.getWorkflowById(targetId) ?? mastra.getWorkflow(targetId);
    case 'scorer':
      return mastra.getScorerById(targetId);
    // processor: resolve from mastra.getProcessor() if exists
  }
}
```

### Pattern 3: Agent Execution
**What:** Execute agent with generate() method, handle both v1 and v2 models
**When to use:** When target is an Agent
**Example:**
```typescript
// Source: packages/core/src/evals/run/index.ts
async function executeAgent(agent: Agent, item: DatasetItem) {
  const model = await agent.getModel();
  if (isSupportedLanguageModel(model)) {
    return await agent.generate(item.input as any, {
      scorers: {},
      returnScorerData: true,
      requestContext: item.requestContext,
    });
  } else {
    return await agent.generateLegacy(item.input as any, {
      scorers: {},
      returnScorerData: true,
      requestContext: item.requestContext,
    });
  }
}
```

### Pattern 4: Workflow Execution
**What:** Execute workflow with createRun().start()
**When to use:** When target is a Workflow
**Example:**
```typescript
// Source: packages/core/src/evals/run/index.ts
async function executeWorkflow(target: Workflow, item: DatasetItem) {
  const run = await target.createRun({ disableScorers: true });
  const workflowResult = await run.start({
    inputData: item.input,
    requestContext: item.requestContext,
  });
  return {
    input: item.input,
    output: workflowResult.status === 'success' ? workflowResult.result : undefined,
    error: workflowResult.status === 'failed' ? workflowResult.error : undefined,
  };
}
```

### Pattern 5: Scorer Execution with Error Isolation
**What:** Run scorer and catch errors without failing the item
**When to use:** For each scorer applied to results
**Example:**
```typescript
// Source: packages/core/src/evals/run/index.ts pattern
async function runScorerSafe(
  scorer: MastraScorer,
  input: unknown,
  output: unknown,
  expectedOutput?: unknown,
) {
  try {
    return await scorer.run({
      input,
      output,
      groundTruth: expectedOutput,
    });
  } catch (error) {
    // Log error, don't fail the item
    return { error: error.message, score: null };
  }
}
```

### Pattern 6: Score Persistence to ScoresStorage
**What:** Save scores using existing ScoresStorage.saveScore()
**When to use:** After each scorer completes
**Example:**
```typescript
// Source: packages/core/src/evals/run/index.ts + packages/core/src/mastra/hooks.ts
import { validateAndSaveScore } from '../mastra/hooks';

async function saveScore(storage: MastraCompositeStore, scoreResult: any) {
  await validateAndSaveScore(storage, {
    ...scoreResult,
    scorerId: scorer.id,
    entityId: targetId,
    entityType: targetType.toUpperCase(),
    source: 'TEST',
    scorer: { id: scorer.id, name: scorer.name, description: scorer.description },
    entity: { id: target.id, name: target.name },
  });
}
```

### Pattern 7: AbortSignal for Cancellation
**What:** Accept AbortSignal and check/propagate during execution
**When to use:** Long-running operations that need cancellation
**Example:**
```typescript
// Source: packages/core/src/workflows/workflow.ts pattern
async function executeWithAbort(signal: AbortSignal, fn: () => Promise<any>) {
  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
  // p-map doesn't directly support AbortSignal, so check between items
  return fn();
}
```

### Anti-Patterns to Avoid
- **Throwing on scorer errors:** Continue on scorer error, log and mark scorer result as errored
- **Blocking on score persistence:** Use fire-and-forget pattern for non-critical score saves
- **Ignoring AbortSignal:** Check signal.aborted between items and stop early
- **Auto-detecting target type:** Always require explicit targetType parameter

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent execution | Manual Promise.all batching | p-map | Backpressure, error handling built-in |
| UUID generation | Custom ID logic | `crypto.randomUUID()` | Standard, secure |
| Score persistence | Custom save logic | `validateAndSaveScore()` | Handles validation, schema |
| Target resolution | instanceof checks | mastra.getAgentById, getWorkflowById | Handles both key and ID lookup |
| Timing measurement | Manual Date.now() diff | `performance.now()` | Higher precision, standard |

**Key insight:** Existing patterns in `packages/core/src/evals/run/index.ts` cover 80% of the execution logic. Extend rather than rebuild.

## Common Pitfalls

### Pitfall 1: Race Conditions in Status Updates
**What goes wrong:** Multiple items complete simultaneously, status updates overwrite each other
**Why it happens:** Read-modify-write without atomicity
**How to avoid:** Use atomic counters or single writer pattern for run status updates
**Warning signs:** `succeededCount + failedCount != totalItems`

### Pitfall 2: Memory Leaks with Large Datasets
**What goes wrong:** Holding all results in memory before returning
**Why it happens:** Accumulating results array grows unbounded
**How to avoid:** Persist results as they complete, don't accumulate full output objects
**Warning signs:** OOM errors with large datasets

### Pitfall 3: Lost Errors on Target Execution
**What goes wrong:** Errors thrown but not captured in result
**Why it happens:** try/catch missing around target execution
**How to avoid:** Wrap each item execution, capture error, latency, output separately
**Warning signs:** Items marked "success" with no output

### Pitfall 4: Scorer Errors Failing the Run
**What goes wrong:** One bad scorer crashes entire run
**Why it happens:** Missing error isolation per scorer
**How to avoid:** Wrap each scorer in try/catch, mark scorer result as errored, continue
**Warning signs:** Runs fail on scorer setup errors

### Pitfall 5: AbortSignal Ignored During Execution
**What goes wrong:** Cancellation requested but run continues
**Why it happens:** Signal checked only at start, not between items
**How to avoid:** Check `signal.aborted` in the p-map mapper function before processing each item
**Warning signs:** Cancelled runs complete anyway

### Pitfall 6: Wrong Dataset Version Used
**What goes wrong:** Items from wrong version included in run
**Why it happens:** Not pinning version when loading items
**How to avoid:** Pass `version` param to `getItemsByVersion()` at run start, cache item set
**Warning signs:** Run includes items added after run started

## Code Examples

### Run Entry Point Pattern
```typescript
// packages/core/src/datasets/run/index.ts
interface RunConfig {
  datasetId: string;
  targetType: 'agent' | 'workflow' | 'scorer' | 'processor';
  targetId: string;
  scorers?: (MastraScorer | string)[];
  version?: Date; // Pin to specific dataset version
  maxConcurrency?: number;
  signal?: AbortSignal;
}

interface ItemResult {
  itemId: string;
  itemVersion: Date;
  input: unknown;
  output: unknown;
  latency: number;
  error: string | null;
  startedAt: Date;
  completedAt: Date;
  retryCount: number;
}

interface RunResult {
  runId: string;
  status: 'completed' | 'failed';
  totalItems: number;
  succeededCount: number;
  failedCount: number;
  results: ItemResult[];
  scores: Record<string, any>[];
}

export async function runDataset(
  mastra: Mastra,
  config: RunConfig
): Promise<RunResult> {
  const runId = crypto.randomUUID();
  const startedAt = new Date();

  // 1. Load dataset and items
  const storage = mastra.getStorage();
  const datasetsStore = storage?.stores.datasets;
  const dataset = await datasetsStore?.getDatasetById({ id: config.datasetId });
  const version = config.version ?? dataset.version;
  const items = await datasetsStore?.getItemsByVersion({
    datasetId: config.datasetId,
    version
  });

  // 2. Resolve target
  const target = resolveTarget(mastra, config.targetType, config.targetId);

  // 3. Resolve scorers (instances or IDs)
  const resolvedScorers = resolveScorers(mastra, config.scorers);

  // 4. Execute with concurrency
  let succeededCount = 0;
  let failedCount = 0;

  const pMap = (await import('p-map')).default;
  const results = await pMap(
    items,
    async (item) => {
      if (config.signal?.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const itemStart = new Date();
      const perfStart = performance.now();

      let output: unknown;
      let error: string | null = null;

      try {
        const result = await executeTarget(target, config.targetType, item);
        output = result.output;
        succeededCount++;
      } catch (e) {
        error = e.message;
        failedCount++;
      }

      const latency = performance.now() - perfStart;
      const itemEnd = new Date();

      // Score inline
      const itemScores = await runScorersForItem(resolvedScorers, item, output);

      return {
        itemId: item.id,
        itemVersion: item.version,
        input: item.input,
        output,
        latency,
        error,
        startedAt: itemStart,
        completedAt: itemEnd,
        retryCount: 0,
        scores: itemScores,
      };
    },
    { concurrency: config.maxConcurrency ?? 5 }
  );

  return {
    runId,
    status: failedCount === items.length ? 'failed' : 'completed',
    totalItems: items.length,
    succeededCount,
    failedCount,
    results,
    scores: results.flatMap(r => r.scores),
  };
}
```

### Run Storage Schema
```typescript
// packages/core/src/storage/constants.ts
export const TABLE_DATASET_RUNS = 'mastra_dataset_runs';

export const DATASET_RUNS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  datasetId: { type: 'text', nullable: false },
  datasetVersion: { type: 'timestamp', nullable: false },
  targetType: { type: 'text', nullable: false },
  targetId: { type: 'text', nullable: false },
  status: { type: 'text', nullable: false }, // pending|running|completed|failed
  totalItems: { type: 'integer', nullable: false },
  succeededCount: { type: 'integer', nullable: false },
  failedCount: { type: 'integer', nullable: false },
  startedAt: { type: 'timestamp', nullable: true },
  completedAt: { type: 'timestamp', nullable: true },
  createdAt: { type: 'timestamp', nullable: false },
  updatedAt: { type: 'timestamp', nullable: false },
};

export const TABLE_DATASET_RUN_RESULTS = 'mastra_dataset_run_results';

export const DATASET_RUN_RESULTS_SCHEMA: Record<string, StorageColumn> = {
  id: { type: 'text', nullable: false, primaryKey: true },
  runId: { type: 'text', nullable: false },
  itemId: { type: 'text', nullable: false },
  itemVersion: { type: 'timestamp', nullable: false },
  input: { type: 'jsonb', nullable: false },
  output: { type: 'jsonb', nullable: true },
  expectedOutput: { type: 'jsonb', nullable: true },
  latency: { type: 'float', nullable: false },
  error: { type: 'text', nullable: true },
  startedAt: { type: 'timestamp', nullable: false },
  completedAt: { type: 'timestamp', nullable: false },
  retryCount: { type: 'integer', nullable: false },
  createdAt: { type: 'timestamp', nullable: false },
};
```

### RunsStorage Domain Pattern
```typescript
// packages/core/src/storage/domains/runs/base.ts
import { StorageDomain } from '../base';
import type { Run, RunResult, CreateRunInput, UpdateRunInput } from '../../types';

export abstract class RunsStorage extends StorageDomain {
  constructor() {
    super({ component: 'STORAGE', name: 'RUNS' });
  }

  abstract createRun(input: CreateRunInput): Promise<Run>;
  abstract updateRun(input: UpdateRunInput): Promise<Run>;
  abstract getRunById(args: { id: string }): Promise<Run | null>;
  abstract listRuns(args: { datasetId?: string; pagination: StoragePagination }): Promise<ListRunsOutput>;

  // Results
  abstract addResult(input: AddResultInput): Promise<RunResult>;
  abstract listResults(args: { runId: string; pagination: StoragePagination }): Promise<ListResultsOutput>;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sequential execution | p-map concurrent | Current | Performance |
| runEvals() standalone | mastra.datasets.run() | Phase 2 | Unified API |

**Deprecated/outdated:**
- None - building on current patterns

## Open Questions

1. **Processor Target Execution**
   - What we know: Processors exist in `packages/core/src/processors/`
   - What's unclear: How to invoke a processor in isolation (not as agent middleware)
   - Recommendation: For v1, defer processor support or treat as function call

2. **Token Usage Extraction**
   - What we know: Agent.generate returns usage info
   - What's unclear: Format differs between v1/v2 models, workflows don't expose usage
   - Recommendation: Extract from agent results where available, null for workflows

3. **TraceId Linking**
   - What we know: Existing scoring hooks can pass traceId/spanId
   - What's unclear: Should runs create their own trace, or accept one?
   - Recommendation: Accept optional tracingContext, create child span for run

## Sources

### Primary (HIGH confidence)
- `packages/core/src/evals/run/index.ts` - runEvals() implementation
- `packages/core/src/evals/run/scorerAccumulator.ts` - Score accumulation pattern
- `packages/core/src/mastra/hooks.ts` - validateAndSaveScore, p-map usage
- `packages/core/src/mastra/index.ts` - getAgent, getWorkflow, getScorerById
- `packages/core/src/storage/domains/datasets/base.ts` - DatasetsStorage from Phase 1
- `packages/core/src/storage/domains/scores/base.ts` - ScoresStorage interface
- `packages/core/src/workflows/workflow.ts` - AbortSignal handling pattern

### Secondary (MEDIUM confidence)
- `packages/core/src/evals/scoreTraces/scoreTracesWorkflow.ts` - p-map with targets
- `packages/core/src/storage/constants.ts` - Schema definition patterns

### Tertiary (LOW confidence)
- None - all findings from direct codebase analysis

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - p-map already used for same purpose
- Architecture: HIGH - extends existing runEvals pattern
- Pitfalls: HIGH - derived from existing code patterns and common async issues

**Research date:** 2026-01-24
**Valid until:** 60 days (internal patterns are stable)
