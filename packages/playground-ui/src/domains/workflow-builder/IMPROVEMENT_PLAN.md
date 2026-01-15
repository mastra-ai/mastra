# Visual Workflow Builder - Improvement Plan

## Vision

A visual workflow builder that is:

- **Reliable** - Workflows save/load/execute correctly every time
- **Intuitive** - Users can build complex workflows without documentation
- **Fast** - Responsive UI, quick feedback loops
- **Accessible** - Keyboard navigable, screen reader friendly (WCAG 2.1 AA)
- **Polished** - Consistent design, smooth animations, helpful feedback

---

## Current State

| Area                | Status | Notes                                                  |
| ------------------- | ------ | ------------------------------------------------------ |
| **Serialization**   | 95%    | All node types handled, `toDefinition()` needs wiring  |
| **Deserialization** | 95%    | All stepGraph types handled, edges need `type: 'data'` |
| **UI Components**   | 85%    | 12 node types exist, panels vary in completeness       |
| **Validation**      | 30%    | Only agent, tool, condition validated                  |
| **Test Runner**     | 10%    | UI exists, not wired to execution                      |
| **Accessibility**   | 40%    | Missing focus traps, ARIA labels, keyboard nav         |
| **Type Safety**     | 60%    | Double-cast patterns, some `any` types                 |
| **Console Logs**    | 100%   | Present throughout (keeping for now per decision)      |

---

## Execution API Pattern

### Core Pattern (from `packages/core/src/workflows/workflow.ts`)

```typescript
// Pattern in core
const run = await workflow.createRun({ runId: '...' });
const result = await run.start({ inputData: {...}, perStep: true });
// OR for streaming
const result = await run.stream({ inputData: {...}, perStep: true });
```

### Client SDK Pattern (from `client-sdks/client-js/src/resources/`)

```typescript
// Step 1: Create a run
const workflow = new Workflow(clientOptions, workflowId);
const { runId } = await workflow.createRun({ resourceId: definitionId });

// Step 2: Execute (multiple options)
const run = new Run(clientOptions, workflowId, runId);

// Option A: Simple execution (returns final result)
const result = await run.resumeAsync({ ... });

// Option B: Stream execution (step-by-step)
const stream = await run.stream({ inputData, perStep: true });
// Stream emits events with type, stepName, data, status...
```

### API Endpoints

| Endpoint                                           | Method | Purpose                               |
| -------------------------------------------------- | ------ | ------------------------------------- |
| `/api/workflows/{id}/create-run`                   | POST   | Create a run, returns `{ runId }`     |
| `/api/workflows/{id}/stream?runId={runId}`         | POST   | Stream execution with `perStep: true` |
| `/api/workflows/{id}/observe-stream?runId={runId}` | POST   | Observe execution stream              |
| `/api/workflows/{id}/runs`                         | GET    | List workflow runs                    |
| `/api/workflows/{id}/runs/{runId}`                 | GET    | Get a specific run                    |
| `/api/workflows/{id}/runs/{runId}/cancel`          | POST   | Cancel a running run                  |

---

## Phase 1: Foundation (Make It Work)

**Goal**: Complete save/load cycle

| ID  | Task                                        | File(s)                                   | Effort | Deps    |
| --- | ------------------------------------------- | ----------------------------------------- | ------ | ------- |
| 1.1 | Wire `toDefinition()` to `serializeGraph()` | `store/workflow-builder-store.ts:701-714` | S      | -       |
| 1.2 | Add `type: 'data'` to deserialized edges    | `utils/deserialize.ts`                    | S      | -       |
| 1.3 | Add edge type migration on load             | `store/workflow-builder-store.ts`         | S      | 1.2     |
| 1.4 | Manual round-trip verification              | -                                         | M      | 1.1-1.3 |
| 1.5 | Remove unused imports                       | Multiple                                  | S      | -       |

**Deliverable**: Workflows with all node types save and reload correctly

**Implementation Details**:

**1.1 - Wire `toDefinition()` to `serializeGraph()`**

```typescript
// In store/workflow-builder-store.ts
import { serializeGraph, serializeGraphFull } from '../utils/serialize';

toDefinition: options => {
  const state = get();
  const { stepGraph, steps } = serializeGraph(state.nodes, state.edges);

  return {
    id: state.workflowId ?? '',
    name: state.workflowName,
    description: state.workflowDescription,
    inputSchema: state.inputSchema,
    outputSchema: state.outputSchema,
    stateSchema: state.stateSchema,
    stepGraph,
    steps,
  };
};
```

**1.2 - Add `type: 'data'` to deserialized edges**

```typescript
// In utils/deserialize.ts - update all edge creation
edges.push({
  id: `e-${lastNodeId}-${entry.step.id}`,
  source: lastNodeId,
  target: entry.step.id,
  type: 'data', // ← Add this to all 7 edge creation locations
});
```

---

## Phase 2: Type Safety & Code Quality

**Goal**: Eliminate unsafe patterns, improve maintainability (runs in parallel with Phase 3)

| ID  | Task                                               | File(s)                                                | Effort | Deps |
| --- | -------------------------------------------------- | ------------------------------------------------------ | ------ | ---- |
| 2.1 | Create type guards for node data access            | `types.ts`                                             | M      | -    |
| 2.2 | Replace `as unknown as XNodeData` with type guards | 12 node components                                     | M      | 2.1  |
| 2.3 | Replace `any` with proper interfaces               | `visual-schema-editor.tsx`                             | S      | -    |
| 2.4 | Standardize input components                       | `agent-network-config.tsx`, `visual-schema-editor.tsx` | S      | -    |
| 2.5 | Move inline styles to Tailwind                     | `visual-schema-editor.tsx`, `condition-config.tsx`     | M      | -    |

**Deliverable**: Clean, type-safe codebase with consistent patterns

---

## Phase 3: Validation

**Goal**: All node types have complete validation rules (runs in parallel with Phase 2)

| ID   | Task                                                               | File(s)                      | Effort | Deps |
| ---- | ------------------------------------------------------------------ | ---------------------------- | ------ | ---- |
| 3.1  | Add validation for `parallel` nodes                                | `use-workflow-validation.ts` | S      | -    |
| 3.2  | Add validation for `loop` nodes (must have condition)              | `use-workflow-validation.ts` | S      | -    |
| 3.3  | Add validation for `foreach` nodes (must have array ref)           | `use-workflow-validation.ts` | S      | -    |
| 3.4  | Add validation for `transform` nodes                               | `use-workflow-validation.ts` | S      | -    |
| 3.5  | Add validation for `suspend` nodes                                 | `use-workflow-validation.ts` | S      | -    |
| 3.6  | Add validation for `workflow` nodes (must select workflow)         | `use-workflow-validation.ts` | S      | -    |
| 3.7  | Add validation for `sleep` nodes (must have duration or timestamp) | `use-workflow-validation.ts` | S      | -    |
| 3.8  | Add validation for `agent-network` nodes                           | `use-workflow-validation.ts` | S      | -    |
| 3.9  | Add validation for disconnected nodes                              | `use-workflow-validation.ts` | S      | -    |
| 3.10 | Add validation for cycles (if not allowed)                         | `use-workflow-validation.ts` | M      | -    |

**Deliverable**: Users see clear errors for any misconfigured node

---

## Phase 4: Test Runner Integration

**Goal**: Users can test workflows from the builder

| ID   | Task                                               | File(s)                                         | Effort | Deps         |
| ---- | -------------------------------------------------- | ----------------------------------------------- | ------ | ------------ |
| 4.1  | Add `useCreateWorkflowRun` hook                    | `hooks/use-create-workflow-run.ts` (new)        | M      | 1.1          |
| 4.2  | Add `useWorkflowRunStream` hook (for step-by-step) | `hooks/use-workflow-run-stream.ts` (new)        | M      | -            |
| 4.3  | Add "must save first" check before test run        | `test-runner-panel.tsx`                         | S      | -            |
| 4.4  | Wire Run button: Save → Create Run → Stream        | `test-runner-panel.tsx`                         | M      | 4.1-4.2, 4.3 |
| 4.5  | Parse stream events and update test runner state   | `test-runner-panel.tsx`                         | L      | 4.2, 4.4     |
| 4.6  | Display execution result (success/failure)         | `test-runner-panel.tsx`                         | S      | 4.5          |
| 4.7  | Display step-by-step progress                      | `test-runner-panel.tsx`                         | S      | 4.5          |
| 4.8  | Store execution history                            | `test-runner-store.ts`                          | S      | 4.5          |
| 4.9  | Implement history item click (view past run)       | `test-runner-panel.tsx`                         | S      | 4.8          |
| 4.10 | Handle suspend/resume UI flow                      | `test-input-modal.tsx`, `test-runner-panel.tsx` | M      | 4.5          |

**Deliverable**: Users can run workflows and see results directly in builder

### Execution Flow

```typescript
1. User clicks "Run Test"
   ↓
2. Check if workflow is saved
   ↓ (if not, show toast and return)
3. Save workflow (get workflowDefinitionId from response)
   ↓
4. Create run: POST /api/workflows/{id}/create-run
   Returns: { runId }
   ↓
5. Stream execution: POST /api/workflows/{id}/stream?runId={runId}
   Body: { inputData, perStep: true }
   Returns: Stream of events
   ↓
6. Parse stream events:
   - workflow-start → set run status to 'running'
   - data-step-start → update step status to 'running', record startedAt
   - data-step-complete → update step status to 'completed', record output, AI metrics, duration
   - data-step-fail → update step status to 'failed', record error, duration
   - suspend → store suspend data, show resume modal
   - workflow-complete → finalize run, show result
   ↓
7. Handle suspend/resume:
   - suspend → show resume modal with resumeSchema fields
   - resume → POST /api/workflows/{id}/resume-async
```

### Stream Event Types

```typescript
interface StreamEvent {
  type:
    | 'workflow-start'
    | 'workflow-complete'
    | 'workflow-fail'
    | 'data-step-start'
    | 'data-step-complete'
    | 'data-step-fail'
    | 'suspend'
    | 'resume';
  runId: string;
  data?: {
    stepName: string;
    output?: unknown;
    error?: string;
    aiMetrics?: { model: string; totalTokens: number; cost: number };
    result?: unknown;
  };
}
```

### Stream Error Handling

```typescript
// Fail on first step error - don't continue execution
try {
  for await (const event of run.stream({ inputData, perStep: true })) {
    if (event.type === 'data-step-fail') {
      // Complete run with error immediately
      completeRun(undefined, event.data?.error);
      break; // Stop processing stream
    }
    // ... handle other events
  }
} catch (error) {
  completeRun(undefined, error.message);
}
```

### Per-Step Data Storage

**Decision**: Store all steps in memory (keep test runner simple)

---

## Questions & Open Items

1. **Workflow Definition ID for Test Runner**: Where is `workflowDefinitionId` available in test runner context? (passed from `WorkflowBuilder` component, available in store, or needs to be fetched?)

2. **Stream Error Handling**: If stream connection drops mid-execution, should we:
   - A) Auto-retry
   - B) Mark run as 'failed' with error "Stream disconnected"
   - C) Keep UI in "unknown" state

3. **Per-Step Data Storage**: The test runner store stores `steps: Record<string, StepResult>`. For step-by-step with many steps, should we:
   - A) Keep all steps in memory (current approach)
   - B) Only store N most recent steps
   - C) Only store currently running/pending steps

4. **Run History Click**: When clicking a history item, should we:
   - A) Show full run details in a modal
   - B) Re-run that specific run with same inputs
   - C) Show just the execution summary (status, duration, AI metrics)

5. **Testing Approach**: Should we create unit tests for serialization/deserialization, or focus on end-to-end workflow execution tests?

---

## Phase 5: Accessibility

**Goal**: WCAG 2.1 AA compliance

| ID  | Task                                                 | File(s)                        | Effort | Deps |
| --- | ---------------------------------------------------- | ------------------------------ | ------ | ---- |
| 5.1 | Add focus trap to command palette                    | `command-palette.tsx`          | M      | -    |
| 5.2 | Add focus trap to keyboard shortcuts panel           | `keyboard-shortcuts-panel.tsx` | M      | -    |
| 5.3 | Add focus trap to test input modal                   | `test-input-modal.tsx`         | M      | -    |
| 5.4 | Add `role="dialog"`, `aria-modal`, `aria-labelledby` | All 3 modals                   | S      | -    |
| 5.5 | Make step items keyboard accessible                  | `step-item.tsx`                | S      | -    |
| 5.6 | Add arrow key navigation to DataReferencePicker      | `data-mapping.tsx`             | M      | -    |
| 5.7 | Add ARIA live regions for state changes              | `builder-toolbar.tsx`          | S      | -    |
| 5.8 | Add visually hidden text for selection state         | `base-node.tsx`                | S      | -    |

**Deliverable**: Fully keyboard navigable, screen reader friendly

---

## Phase 6: UX Polish

**Goal**: Delightful, consistent interactions

| ID   | Task                                          | File(s)                                         | Effort | Deps |
| ---- | --------------------------------------------- | ----------------------------------------------- | ------ | ---- |
| 6.1  | Add save success toast                        | `builder-toolbar.tsx`                           | S      | -    |
| 6.2  | Add save error toast                          | `builder-toolbar.tsx`                           | S      | -    |
| 6.3  | Add node deletion confirmation (if connected) | `base-node.tsx`                                 | S      | -    |
| 6.4  | Add tooltips to undo/redo buttons             | `builder-toolbar.tsx`                           | S      | -    |
| 6.5  | Add tooltip to delete button                  | `base-node.tsx`                                 | S      | -    |
| 6.6  | Add tooltip to quick-add button               | `base-node.tsx`                                 | S      | -    |
| 6.7  | Standardize transition durations to 150ms     | Multiple                                        | S      | -    |
| 6.8  | Add entrance animations to panels             | `validation-panel.tsx`, `test-runner-panel.tsx` | S      | -    |
| 6.9  | Extract hardcoded colors to CSS variables     | `data-edge.tsx`, `builder-canvas.tsx`           | M      | -    |
| 6.10 | Auto-scroll canvas to validation issues       | `validation-panel.tsx`                          | S      | -    |

**Deliverable**: Polished, professional feel

---

## Phase 7: Config Panel Completion

**Goal**: All node types fully configurable

| ID  | Task                                   | File(s)                    | Effort | Deps |
| --- | -------------------------------------- | -------------------------- | ------ | ---- |
| 7.1 | Add custom duration input for sleep    | `sleep-config.tsx`         | S      | -    |
| 7.2 | Add workflow selection dropdown        | `workflow-config.tsx`      | M      | -    |
| 7.3 | Add input mapping UI for sub-workflows | `workflow-config.tsx`      | M      | 7.2  |
| 7.4 | Wire agent network fetching            | `agent-network-config.tsx` | M      | -    |
| 7.5 | Add per-panel error boundaries         | `properties-panel.tsx`     | S      | -    |
| 7.6 | Expand empty state quick actions       | `empty-state.tsx`          | S      | -    |

**Deliverable**: Every node type can be fully configured

---

## Phase 8: Advanced Features (Future)

**Goal**: Power user functionality

| ID   | Task                                        | Effort | Notes                                          |
| ---- | ------------------------------------------- | ------ | ---------------------------------------------- | ------------- |
| 8.1  | SSE integration for real-time step progress | L      | Stream updates during execution                |
| 8.2  | Animated edges during execution             | M      | Already built DataEdge, just needs integration |
| 8.3  | Right-click context menus                   | M      | Copy, paste, delete, duplicate                 |
| 8.4  | Expression builder for transforms           | L      | Template syntax support ({{ steps.x            | uppercase }}) |
| 8.5  | Loop/parallel body visualization            | L      | Show nested steps inline                       |
| 8.6  | Box selection (drag to select)              | M      | Currently disabled due to React Flow conflicts |
| 8.7  | Workflow templates/presets                  | M      | Start from common patterns                     |
| 8.8  | Version history diff view                   | L      | Compare workflow versions                      |
| 8.9  | Real-time collaboration                     | XL     | Multi-user editing                             |
| 8.10 | Performance optimization                    | L      | Handle workflows with 100+ nodes               |

---

## Execution Strategy

### Phase Ordering

Based on your decisions:

- Phase 2 and 3 run in **parallel**
- Phase 5 runs **after** Phase 2 & 3
- Phase 4 runs **independently** after Phase 1

```
Phase 1 (Foundation)
    ├─→ Phase 2 (Type Safety) ─────┐
    └─→ Phase 3 (Validation) ────┘
                    ↓
Phase 4 (Test Runner) ←───────────────────┘
                    ↓
Phase 5 (Accessibility)
    ↓
Phase 6 (UX Polish)
    ↓
Phase 7 (Config Completion)
    ↓
Phase 8 (Advanced Features)
```

---

## Questions & Open Items

1. **Workflow Definition ID for Test Runner**: Where is `workflowDefinitionId` available in test runner context? (passed from `WorkflowBuilder` component, available in store, or needs to be fetched?)

2. **Stream Error Handling**: If stream connection drops mid-execution, should we:
   - A) Auto-retry
   - B) Mark run as 'failed' with error "Stream disconnected"
   - C) Keep UI in "unknown" state

3. **Per-Step Data Storage**: The test runner store stores `steps: Record<string, StepResult>`. For step-by-step with many steps, should we:
   - A) Keep all steps in memory (current approach)
   - B) Only store N most recent steps
   - C) Only store currently running/pending steps

4. **Run History Click**: When clicking a history item, should we:
   - A) Show full run details in a modal
   - B) Re-run that specific run with same inputs
   - C) Show just the execution summary (status, duration, AI metrics)

5. **Testing Approach**: Should we create unit tests for serialization/deserialization, or focus on end-to-end workflow execution tests?

---

## Effort Estimates

| Phase     | Tasks  | Small  | Medium | Large | Total Est.      |
| --------- | ------ | ------ | ------ | ----- | --------------- |
| 1         | 5      | 4      | 1      | 0     | ~1.5 hours      |
| 2         | 5      | 3      | 2      | 0     | ~2 hours        |
| 3         | 10     | 9      | 1      | 0     | ~2 hours        |
| 4         | 10     | 9      | 3      | 0     | ~3 hours        |
| 5         | 8      | 5      | 3      | 0     | ~3 hours        |
| 6         | 10     | 9      | 1      | 0     | ~2 hours        |
| 7         | 6      | 3      | 3      | 0     | ~2.5 hours      |
| 8         | 0      | 0      | 10     | 0     | Future          |
| **Total** | **54** | **42** | **24** | **0** | **~16.5 hours** |

---

## How to Use This Plan

1. **Before each session**: Read the next phase's tasks and dependencies
2. **During session**: Check off tasks as completed
3. **After session**: Update this file with progress notes
4. **Between sessions**: Note any new ideas in Phase 8 (Advanced Features)
5. **Regularly**: Re-prioritize based on user feedback

---

## Tracking

- **Created**: January 14, 2025
- **Last Updated**: January 14, 2025
- **Completed Sessions**: 1-7 (previous sessions)
- **Current Session**: 8
- **Next Session**: TBD

---

## Archive

The previous session plan documents have been archived:

- `SESSION_PLAN.md` - Original session-by-session plan
- `PARALLEL_PLAN.md` - Parallel execution tracks

This consolidated plan replaces both.
