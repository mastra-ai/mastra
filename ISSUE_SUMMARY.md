# Issue #6322: Memory Leak Analysis

## Overview

GitHub Issue: https://github.com/mastra-ai/mastra/issues/6322
Status: **INVESTIGATING** - Root causes being explored
Severity: **CRITICAL** - Production services crashing every 5-30 minutes

## Problem Description

Production services running @mastra/core v0.21.1 experience heap exhaustion and crash with OOM errors. Issue does not occur with v0.13.2.

### Key Symptoms

- Services crash every 5-30 minutes under normal load
- Memory usage grows unboundedly over time
- TypeError exceptions preceding some crashes
- Affects both explicit workflows and agent.stream() calls

## Reports Summary

### Initial Report (leo-paz)

- Node.js heap out of memory after running workflow twice in `mastra dev`
- Large deal context object (~20k tokens, ~800 LOC input)
- Crash occurs on second workflow execution at step 2
- Step 2 generates ~100 LOC schema
- Using PostgresStore
- Stack trace shows JSON stringification/parsing operations during memory exhaustion
- Packages: @mastra/core: 0.11.1, @mastra/memory: 0.11.5, @mastra/pg: 0.12.5

### Production Impact (Stefan Kruger, Oct 21, 2025)

- Production services crashing every 5-30 minutes
- Upgraded from @mastra/core ^0.13.2 to ^0.21.1
- Using agent.stream() calls (not explicit workflows)
- Timeline: Crashes every 5 minutes initially, then ~30 minutes after increasing memory
- Rolled back to v0.13.2 and now stable
- Stack trace:
  ```
  TypeError: Cannot use 'in' operator to search for 'format' in 4822
  at Function.isMastraMessageV2 (.../message-list/index.ts:979:9)
  at Memory.query (.../memory/src/index.ts:184:60)
  ```

### Additional Reports

- **sccorby**: Same leak, takes many workflow runs to trigger
  - Later update: Issue occurring even outside of workflow execution
  - Stack trace shows: JSON parsing operations (`JsonParser<unsigned short>::ParseJsonObject`)
- **AtiqGauri**: Long-running agents crash after ~1 hour
  - Using simple `agent.stream` on long-running agent
  - Stack trace shows `JsonStringify` during memory exhaustion
- **danhumphrey**: Memory graph shows steady accumulation
- **leo-paz Update (Aug 6, 2025)**: Issue improved after upgrading to AI SDK v5 but still occurs

## Current Investigation Status

### Key Finding: agent.stream() Uses Workflows Internally

Even "simple" agent.stream() calls create internal workflows:

```typescript
agent.stream()
  → createPrepareStreamWorkflow()  // Creates internal workflow
  → workflow.createRunAsync()       // Creates run
  → new MastraModelOutput()         // Creates output with buffers
```

This explains why all usage patterns exhibit similar symptoms.

### Issue Flow Diagram

```
agent.stream() called
    ↓
Creates Workflow (stored in #runs Map - potential LEAK)
    ↓
Creates MastraModelOutput
    ├→ Buffers ALL chunks (#bufferedChunks - LEAK)
    ├→ Buffers ALL steps (#bufferedSteps - LEAK)
    ├→ Creates EventEmitters (listeners - potential LEAK)
    └→ Creates ProcessorStates (accumulates text - LEAK)
    ↓
If Memory enabled:
    └→ Memory.query() returns malformed data → TypeError
```

### Primary Suspect: EventEmitter Buffer Accumulation

**Commit bc5aacb646** (Oct 1, 2025) introduced EventEmitter-based streaming with buffer replay:

```typescript
#bufferedChunks: ChunkType<OUTPUT>[] = [];  // Never cleared

#emitChunk(chunk) {
  this.#bufferedChunks.push(chunk);  // Accumulates forever
  this.#emitter.emit('chunk', chunk);
}
```

### Why Not Just Clear Buffers?

Clearing buffers would break legitimate functionality - the buffers enable concurrent access to different stream views (fullStream, objectStream, textStream).

### Working Hypotheses

1. **Reference Cycles**: Buffered chunks may create circular references preventing GC
2. **Lifecycle Issues**: MastraModelOutput/workflow instances not being garbage collected
3. **Accumulation Points**: Multiple buffers at different levels compound the issue

## How The Issue Manifests

### Pattern 1: Workflow Execution OOM (leo-paz, sccorby)

- **Trigger**: Large objects (~20k tokens) + multiple workflow steps
- **Timeline**: 2nd execution crashes (leo-paz), many executions crash (sccorby)
- **Cause**: Large objects × buffered chunks × multiple steps = exponential growth

### Pattern 2: Agent Streaming OOM (Stefan, Rares, AtiqGauri)

- **Trigger**: Simple agent.stream() under production load
- **Timeline**: 5-30 minutes in production, ~1 hour for long-running
- **Cause**: Each stream creates workflow + buffers that never release

### Pattern 3: TypeError with Memory System (Stefan)

- **Trigger**: Memory system enabled + accumulated buffers create malformed data
- **Error**: `TypeError: Cannot use 'in' operator to search for 'format' in 4822`
- **Cause**: Memory corruption → malformed vector metadata → number passed as message

## Environment Context

### Affected Versions

- @mastra/core: 0.11.1, 0.13.2 → 0.21.1 (regression introduced)
- Node.js: v22.16.0, v23.11.0

### Configuration Patterns

- PostgresStore for storage
- Large data objects (20k tokens)
- Production environments with sustained traffic
- Development mode (`mastra dev`)

## Related Files

- [TESTING.md](TESTING.md) - Test suite for validating fixes
- [FIXES.md](FIXES.md) - Potential solutions being explored
- [COMMIT_ANALYSIS.md](COMMIT_ANALYSIS.md) - Analysis of commits between v0.13.2 and v0.21.1
- [ISSUE_SUMMARY_OLD.md](ISSUE_SUMMARY_OLD.md) - Previous detailed analysis

## Next Steps

1. Identify what keeps references to MastraModelOutput/workflow instances alive
2. Explore solutions that preserve concurrent stream access functionality
3. Validate fixes with production-like load patterns
4. Document the proper lifecycle and cleanup patterns
