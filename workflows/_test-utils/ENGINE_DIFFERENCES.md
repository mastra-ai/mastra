# Workflow Engine Differences

This document tracks behavioral differences between the three workflow engines (Default, Evented, Inngest) and explains why certain tests are skipped on each engine.

---

## Overview

| Engine | Architecture | Passed | Skipped | Notes |
|--------|--------------|--------|---------|-------|
| Default | In-memory execution | 170/175 | 5 | Reference implementation |
| Evented | Event-driven with pubsub | 144/175 | 31 | Uses Mastra pubsub |
| Inngest | Durable execution | 142/173 | 31 | Uses Inngest step memoization |

---

# Default Engine

The default engine is the reference implementation with minimal skips.

## Skipped Tests (5)

| Skip Flag | Test | Reason |
|-----------|------|--------|
| `abortDuringStep` | Abort signal during step | 5s timeout waiting for abort signal propagation |

---

# Evented Engine

The evented engine uses Mastra's pubsub for event-driven workflow execution.

## Skipped Tests (31)

### State Management (3 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `state` | State propagation tests | State not fully propagated through event system |

### Error Handling (2 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `errorIdentity` | Error properties preservation | Error properties lost during event serialization |
| `schemaValidationThrows` | Sync validation errors | Validation happens async, returns result instead of throwing |

### Abort Behavior (2 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `abortStatus` | Abort returns 'canceled' | Returns 'failed' instead of 'canceled' |
| `abortDuringStep` | Abort during step execution | 5s timeout waiting for abort signal propagation |

### Foreach (2 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `emptyForeach` | Empty array in foreach | Empty array causes timeout (no items to process) |
| `foreachPartialConcurrencyTiming` | Timing assertions | Event overhead makes timing assertions flaky |

### Resume - Engine Differences (6 tests)

These resume tests fail due to fundamental differences in how the evented engine handles parallel and nested suspend/resume.

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `resumeNested` | Nested workflow resume | Still suspended after resume - nested step path handling differs |
| `resumeBranchingStatus` | Parallel branch step status | `branch-step-2` undefined - parallel branch tracking differs |
| `resumeLoopInput` | Loop resume with input | Timeout - loop resume coordination not working |
| `resumeForeachIndex` | forEachIndex parameter | Wrong status - forEachIndex resume broken |
| `resumeParallelMulti` | Multiple parallel suspends | Only one parallel step gets suspended path |
| `resumeMultiSuspendError` | Multiple suspend detection | Only 1 suspended step found, expects >1 |

### Storage (1 test)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `storageWithNestedWorkflows` | Nested step naming | Different step naming convention for nested workflows |

### Callbacks (1 test)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `callbackResourceId` | resourceId in callbacks | resourceId not passed to onFinish/onError callbacks |

### Validation (2 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `executionFlowNotDefined` | No steps defined error | Evented throws different error message |
| `executionGraphNotCommitted` | Uncommitted graph error | Evented throws different error message |

### Time Travel (1 test)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `timeTravelConditional` | Conditional time travel | Result structure includes empty `branchB: {}` |

---

# Inngest Engine

The Inngest engine uses durable execution with step memoization.

## Inngest-Specific Features (Not in Shared Suite)

| Category | Tests | Description |
|----------|-------|-------------|
| Flow Control | 4 | `throttle`, `rateLimit`, `concurrency`, `debounce` |
| Scheduling | 2 | `cron schedule`, `cron with initialState` |
| Serve Function | 3 | `inngestServe()` patterns |
| Inngest Primitives | 1 | Direct `step.run()` access |
| Realtime Streaming | 3 | `@inngest/realtime` features |
| Eval Framework | 2 | Inngest eval framework |

## Skipped Tests (31)

### Validation Timing (3 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `schemaValidationThrows` | Sync validation | Validation async, returns result |
| `executionFlowNotDefined` | No steps error | No validation in `createRun()` |
| `executionGraphNotCommitted` | Uncommitted error | No validation in `createRun()` |

**Root Cause:** `InngestWorkflow.createRun()` overrides parent without calling validation.

### Suspend/Resume (11 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `resumeMultiSuspendError` | Multiple suspend detection | No `suspended[]` array in result |
| `resumeAutoDetect` | Auto-detect suspended step | No array to detect from |
| `resumeForeachLoop` | Foreach item suspend | Different step coordination |
| `resumeForeachConcurrent` | Concurrent foreach | Returns 'failed' instead of 'suspended' |
| `resumeForeachIndex` | forEachIndex parameter | Not fully supported |
| `resumeNested` | Nested workflow resume | Not supported |
| `resumeConsecutiveNested` | Consecutive nested | Not supported |
| `resumeDountil` | Dountil loop resume | Not supported |
| `resumeLoopInput` | Loop input tracking | Not supported |
| `resumeMapStep` | Map step resume | Not supported |
| `resumeBranchingStatus` | Branching status | Returns 'failed' instead of 'suspended' |

**Root Cause:** Inngest uses step memoization. Complex resume scenarios need coordination not yet implemented.

### Status Values (1 test)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `abortStatus` | Abort status | Returns 'failed' or 'success' instead of 'canceled' |

**Root Cause:** Inngest cancel mechanism doesn't map to 'canceled' status.

### Storage/Naming (1 test)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `storageWithNestedWorkflows` | Nested step naming | Different naming via `step.invoke()` |

**Root Cause:** `step.invoke()` stores results with different key structure.

### Timing (2 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `foreachConcurrentTiming` | Concurrent timing | ~6000ms vs expected <2000ms |
| `foreachPartialConcurrencyTiming` | Partial timing | ~7000ms vs expected <1500ms |

**Root Cause:** Inngest adds 100-500ms network overhead per step.

### Race Conditions (1 test)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `foreachSingleConcurrency` | Single concurrency foreach | Race with snapshot persistence |

### Unsupported Features (7 tests)

| Skip Flag | Test | Difference |
|-----------|------|------------|
| `restart` (domain) | Restart workflow (4 tests) | Throws "not supported on inngest workflows" |
| `cloneAsSteps` | Clone workflows | Cloned workflows need Mastra registration |
| `runCount` | Run count tracking | Different loop behavior |
| `retryCount` | Retry count tracking | Different retry tracking |

---

# Comparison Matrix

## Resume Functionality

| Feature | Default | Evented | Inngest |
|---------|---------|---------|---------|
| Basic resume | Yes | Yes | Yes |
| Label-based resume | Yes | Yes | Partial |
| Auto-detect suspended step | Yes | Yes | No |
| Foreach resume | Yes | Yes | Partial |
| Concurrent foreach resume | Yes | Yes | No |
| forEachIndex parameter | Yes | Partial | No |
| Nested workflow resume | Yes | Partial | No |
| Parallel multi-suspend | Yes | Partial | No |
| Loop input preservation | Yes | No | No |
| State preservation | Yes | Yes | Yes |

## Error Handling

| Feature | Default | Evented | Inngest |
|---------|---------|---------|---------|
| Error properties preserved | Yes | No | Partial |
| Sync validation errors | Yes | No | No |
| Error cause chain | Yes | Yes | Yes |

## Abort/Cancel

| Feature | Default | Evented | Inngest |
|---------|---------|---------|---------|
| Cancel returns 'canceled' | Yes | No | No |
| Abort signal propagation | Slow | Slow | N/A |

---

# Skip Configuration Reference

## Default Engine (`index.test.ts`)

```typescript
skipTests: {
  abortDuringStep: true,
}
```

## Evented Engine (`evented.test.ts`)

```typescript
skipTests: {
  // State
  state: true,

  // Error handling
  errorIdentity: true,
  schemaValidationThrows: true,

  // Abort
  abortStatus: true,
  abortDuringStep: true,

  // Foreach
  emptyForeach: true,
  foreachPartialConcurrencyTiming: true,

  // Resume
  resumeNested: true,
  resumeBranchingStatus: true,
  resumeLoopInput: true,
  resumeForeachIndex: true,
  resumeParallelMulti: true,
  resumeMultiSuspendError: true,

  // Storage/Callbacks
  storageWithNestedWorkflows: true,
  callbackResourceId: true,

  // Validation
  executionFlowNotDefined: true,
  executionGraphNotCommitted: true,

  // Time travel
  timeTravelConditional: true,
}
```

## Inngest Engine (`workflow-factory.test.ts`)

```typescript
skipTests: {
  // Timing
  foreachConcurrentTiming: true,
  foreachPartialConcurrencyTiming: true,

  // Validation
  schemaValidationThrows: true,
  executionFlowNotDefined: true,
  executionGraphNotCommitted: true,

  // Status
  abortStatus: true,

  // Resume
  resumeMultiSuspendError: true,
  resumeForeachLoop: true,
  resumeForeachConcurrent: true,
  resumeForeachIndex: true,
  resumeAutoDetect: true,
  resumeBranchingStatus: true,
  resumeNested: true,
  resumeConsecutiveNested: true,
  resumeDountil: true,
  resumeLoopInput: true,
  resumeMapStep: true,

  // Storage
  storageWithNestedWorkflows: true,

  // Race conditions
  foreachSingleConcurrency: true,

  // Unsupported
  cloneAsSteps: true,
  runCount: true,
  retryCount: true,
}

skip: {
  restart: true, // Domain-level skip
}
```

---

# Future Work

## Evented Engine

1. **State propagation** - Fix state not propagating through event system
2. **Parallel suspend tracking** - Fix multiple parallel steps not all getting suspended paths
3. **Nested resume** - Fix nested workflow resume behavior
4. **Error serialization** - Preserve error properties during serialization

## Inngest Engine

1. **Add `suspended[]` array** - Enable auto-detect and multi-suspend features
2. **Foreach coordination** - Implement foreach index tracking
3. **Nested resume** - Implement nested step path handling
4. **Validation in createRun()** - Call parent validation

## All Engines

1. **Abort signal propagation** - Reduce 5s timeout for abort during step
2. **Cancel status alignment** - Standardize 'canceled' vs 'failed' behavior
