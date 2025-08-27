# Nested Workflow Tracing Context Plan

## Problem Statement

Currently, when workflows are nested inside other workflows (e.g., using `.dowhile(outerLLMWorkflow, condition)`), the tracing context doesn't flow properly through the nested execution. This results in broken span hierarchies where nested workflow spans become siblings of the main workflow span instead of proper children of their step spans.

### Current Broken Hierarchy
```
Agent Span
├── Main Workflow Span (agentic-loop)
│   └── Loop Span (dowhile)
│       └── Step Span (outerLLMWorkflow step)
└── Nested Workflow Span (outerLLMWorkflow) ← Wrong parent!
    └── LLM Generation Span
        └── LLM Chunk Event Spans
```

### Desired Correct Hierarchy
```
Agent Span
└── Main Workflow Span (agentic-loop)
    └── Loop Span (dowhile)
        └── Step Span (outerLLMWorkflow step)
            └── Nested Workflow Span (outerLLMWorkflow) ← Correct parent!
                └── LLM Generation Span
                    └── LLM Chunk Event Spans
```

## Root Cause Analysis

The issue occurs because:

1. **Workflow-as-Step Execution**: When a workflow is used as a step (like `outerLLMWorkflow` in a `.dowhile()`), it's executed through the `Step.execute()` interface
2. **Missing TracingContext**: The step execution system passes `tracingContext: { currentSpan: stepAISpan }` to steps, but the `Workflow.execute()` method only accepts `currentSpan` parameter, not `tracingContext`  
3. **Wrong Parent Span**: The `currentSpan` parameter contains the original workflow's span, not the step span that should be the immediate parent
4. **API Inconsistency**: Mix of `currentSpan` and `tracingContext` parameters across different execution paths

## Solution: Unified TracingContext API

Replace the inconsistent mix of `currentSpan` and `tracingContext` parameters with a unified `tracingContext` parameter throughout the workflow system.

### Key Changes

#### 1. Update Workflow.execute() Method
**File**: `packages/core/src/workflows/workflow.ts` (lines ~1029-1113)

```typescript
// Before
async execute({
  // ... other params
  currentSpan,
}: {
  // ... other params  
  currentSpan?: AnyAISpan;
})

// After
async execute({
  // ... other params
  tracingContext,
}: {
  // ... other params
  tracingContext?: TracingContext;
})
```

#### 2. Update Run.start() and Run.resume() Methods
**File**: `packages/core/src/workflows/workflow.ts` (lines ~1291-1334, ~1563-1703)

```typescript
// Before
async start({
  inputData,
  runtimeContext,
  writableStream,
  currentSpan,
}: {
  inputData?: z.infer<TInput>;
  runtimeContext?: RuntimeContext;
  writableStream?: WritableStream<ChunkType>;
  currentSpan?: AnyAISpan;
})

// After
async start({
  inputData,
  runtimeContext,
  writableStream,
  tracingContext,
}: {
  inputData?: z.infer<TInput>;
  runtimeContext?: RuntimeContext;
  writableStream?: WritableStream<ChunkType>;
  tracingContext?: TracingContext;
})
```

#### 3. Update ExecutionEngine.execute() Method
**File**: `packages/core/src/workflows/default.ts` (lines ~153-175)

```typescript
// Before
async execute<TInput, TOutput>(params: {
  // ... other params
  currentSpan?: AnyAISpan;
})

// After  
async execute<TInput, TOutput>(params: {
  // ... other params
  tracingContext?: TracingContext;
})
```

#### 4. Update Workflow Execute Logic
**File**: `packages/core/src/workflows/workflow.ts` (lines ~1087-1089)

```typescript
// Before
const res = isResume
  ? await run.resume({ resumeData, step: resume.steps as any, runtimeContext, currentSpan })
  : await run.start({ inputData, runtimeContext, currentSpan });

// After
const res = isResume
  ? await run.resume({ resumeData, step: resume.steps as any, runtimeContext, tracingContext })
  : await run.start({ inputData, runtimeContext, tracingContext });
```

### Expected Execution Flow

1. **Step Execution**: `executeStep()` calls nested workflow with `tracingContext: { currentSpan: stepAISpan }`
2. **Workflow Execute**: Nested workflow receives `tracingContext` containing the step span
3. **Run Creation**: Nested workflow passes `tracingContext` to `run.start()`
4. **Span Creation**: Nested workflow span is created as child of step span (`tracingContext.currentSpan`)
5. **Proper Hierarchy**: All child operations inherit correct span hierarchy

## Implementation Files

### Core Files to Modify:
- `packages/core/src/workflows/workflow.ts` - Main workflow class
- `packages/core/src/workflows/default.ts` - Default execution engine
- `packages/core/src/workflows/types.ts` - Update interface signatures if needed

### Files That Use These APIs:
- `packages/core/src/loop/workflow/stream.ts` - Where the nested dowhile occurs
- `packages/core/src/agent/index.ts` - Agent workflow execution
- Any other files that call workflow methods with tracing context

## Breaking Changes

⚠️ **This is a breaking change** for the experimental AI tracing feature:

- All calls to `workflow.execute()`, `run.start()`, `run.resume()` will need to update parameter names
- Any code passing `currentSpan` will need to update to `tracingContext: { currentSpan }`
- Since this is experimental, breaking changes are acceptable

## Benefits

1. **Consistent API**: Single `tracingContext` parameter across all workflow methods
2. **Proper Span Hierarchy**: Nested workflows become children of their step spans  
3. **Future-Proof**: `TracingContext` can hold additional context beyond just spans
4. **Type Safety**: Single parameter type throughout the system
5. **Clear Intent**: Makes tracing context flow explicit and obvious

## Testing

After implementation, verify:
1. Nested workflow spans appear as children of their step spans in tracing output
2. LLM generation spans within nested workflows maintain proper hierarchy
3. LLM chunk event spans are properly nested under LLM generation spans
4. All existing workflow functionality continues to work
5. No orphaned or incorrectly parented spans in tracing output

## Example Usage After Implementation

```typescript
// Direct workflow execution
const run = await workflow.createRunAsync();
await run.start({ 
  inputData: {...}, 
  tracingContext: { currentSpan: agentSpan } 
});

// Nested workflow in dowhile loop
mainWorkflow.dowhile(nestedWorkflow, condition);
// TracingContext flows automatically through step execution
```

This plan ensures that tracing context flows correctly through nested workflow execution while providing a clean, consistent API for future development.

## Background Context

### What Led to This Problem
- We were implementing AI tracing event spans for streaming chunks in both V1 and V2 LLM systems
- Event spans were successfully implemented for LLM chunk streaming 
- The specific issue arose in `/packages/core/src/loop/workflow/stream.ts` line 74 where `.dowhile(outerLLMWorkflow, async ({ inputData }) => {` creates a nested workflow
- The nested workflow's spans were not properly inheriting from their parent step spans

### Current AI Tracing Implementation Status
- ✅ Event spans are working for LLM chunks in both V1 (`model.ts`) and V2 (`model.loop.ts`) 
- ✅ LLM_GENERATION spans are properly created in the V2 pipeline
- ✅ Strongly typed `AISpan<AISpanType.LLM_GENERATION>` is being used for `llmAISpan`
- ✅ All 52 AI tracing tests are passing
- ❌ Nested workflow tracing context is broken (this plan fixes it)

### Key Files and Their Current State

#### Already Working Correctly:
- `packages/core/src/ai-tracing/types.ts` - Contains all span types including LLM_CHUNK
- `packages/core/src/ai-tracing/base.ts` - Event span logic works correctly
- `packages/core/src/llm/model/model.ts` - V1 chunk events work
- `packages/core/src/llm/model/model.loop.ts` - V2 LLM spans and chunk events work
- `packages/core/src/loop/workflow/stream.ts` - Chunk events work, but nested workflow spans don't

#### Need Changes (This Plan):
- `packages/core/src/workflows/workflow.ts` - Main workflow execute() method
- `packages/core/src/workflows/default.ts` - Execution engine
- Any callers of workflow methods with tracing

### How Workflows Work as Steps
Critical understanding: The `Workflow` class implements the `Step` interface (line 390 in workflow.ts), so when you do `.dowhile(outerLLMWorkflow, condition)`, the workflow's `execute()` method gets called directly by the step execution system. This is why we need to update the `execute()` signature to receive `tracingContext` properly.

### Key Debugging Context
- The issue was discovered while trying to pass tracing context to nested workflows
- The user noted: "I would have expected you to create an LLM_Generation Span somewhere in between #execute() and the loop stuff"  
- We traced through how `executeStep()` calls `runStep()` which calls `step.execute()` (the workflow's execute method)
- The problem is that `execute()` only receives `currentSpan` but needs to receive `tracingContext.currentSpan` (the step span) as the parent

### Current Span Types in Use
```typescript
enum AISpanType {
  AGENT_RUN = 'agent_run',
  LLM_GENERATION = 'llm_generation', 
  LLM_CHUNK = 'llm_chunk',           // For streaming chunks (event spans)
  WORKFLOW_RUN = 'workflow_run',
  WORKFLOW_STEP = 'workflow_step', 
  WORKFLOW_LOOP = 'workflow_loop',   // For dowhile/dountil loops
  // ... others
}
```

### Test Command for Verification
After implementing changes, run:
```bash
pnpm test:core  # Run core package tests
# Look specifically for ai-tracing tests to ensure 52 tests still pass
```

### Specific Line References (Current)
- `stream.ts:74` - Where nested workflow starts: `.dowhile(outerLLMWorkflow, async ({ inputData }) => {`
- `workflow.ts:390` - Workflow implements Step interface
- `workflow.ts:1061` - Current execute() method signature with currentSpan
- `default.ts:828` - Where tracingContext gets passed to steps but not workflows

This context should help resume the work efficiently by understanding both what's already working and exactly what needs to be fixed.