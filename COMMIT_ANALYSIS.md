# Commit Analysis for Memory Leak Issue #6322

## Goal

Identify which commit(s) between v0.13.2 (working) and v0.21.1 (OOM crashes) introduced the memory leak.

## Analysis Scope

Focusing on commits related to:

- Stream processing (MastraModelOutput, buffering)
- Workflow execution (runs, lifecycle)
- Memory/state management

## Key Findings from Deep Dive

### Primary Suspect ⚠️

**bc5aacb646** (Oct 1, 2025) - Structured output stream processor (#8229)

- **Impact**: CRITICAL - Introduced EventEmitter-based streaming with unbounded buffering
- **What changed**: Added `#bufferedChunks` array that stores ALL chunks for replay
- **Code**: `this.#bufferedChunks.push(chunk)` with comment "add to bufferedChunks for replay in new streams"
- **Problem**: Buffers NEVER cleared, accumulate forever
- **Files**: Modified output.ts (346 lines), removed ProcessorRunnerMode from runner.ts

### Related Buffer/Memory Commits 🔍

**1b0eb147b9** - fix: set bufferedChunk and emit chunk after mutations

- **Relevance**: HIGH - Moved buffering logic into #emitChunk() method
- **Impact**: Related to bc5aacb646, part of the buffering implementation

**61adb28535** - stepResult.reasoning resolve full buffered reasoning details

- **Relevance**: MEDIUM - Changes how reasoning is buffered
- **Impact**: Accumulates reasoning details in memory

**6c9a34524a** - save in memory

- **Relevance**: MEDIUM - Adds memory persistence during streaming
- **Impact**: Could affect memory lifecycle

**4c2aec3913** - keep subagentthreadid and subagentresourceid in memory

- **Relevance**: LOW - Adds metadata to memory storage

### EventEmitter/Architecture Changes 🏗️

**d3ae6f1334** - evented stream fix: only start consumption when read

- **Relevance**: MEDIUM - Changes stream consumption timing
- **Impact**: Affects when buffers start accumulating

**bd2572cd74** - fix: dont emit errors to new streams

- **Relevance**: LOW - Error handling change

**463b3e898e** - fix: close event streams when base stream errors

- **Relevance**: MEDIUM - Cleanup behavior on errors

**222965a98c** - Resumable streams (#7949)

- **Relevance**: HIGH - Adds stream resumption capability
- **Impact**: May keep streams/buffers alive longer

**ba82abe76e** - Event based execution engine (#6923)

- **Relevance**: HIGH - Major architecture change (Aug 26, 2025)
- **Impact**: Introduced event-based workflow execution (but NOT EventEmitter in output.ts)

### Stream/Workflow Integration 🔄

**d41aee526d** - feat!: streamVNext->stream, stream->streamLegacy (#8097)

- **Relevance**: HIGH - Major API change
- **Impact**: Changed how streams are created and managed

**2454423e33** - generateVNext and streamVNext (#6877)

- **Relevance**: MEDIUM - New streaming implementation

**7620d2bdde** / **232f167996** - Initial state on .stream() on workflows

- **Relevance**: HIGH - Adds workflow state to streaming
- **Impact**: Workflows now maintain state during streaming

### Processor-Related 🔧

**37a23148e0** - feat(core): add-tracing-to-processors (#8623)

- **Relevance**: LOW - Added tracing but didn't change accumulation
- **Note**: ProcessorState accumulation existed before (from 6faaee5908 in Aug)

**b2babfa9e7** / **d0b90ab83a** - output processors before saving to memory

- **Relevance**: MEDIUM - Changes when processors run
- **Impact**: Affects memory timing and lifecycle

## Commits Marked as Irrelevant ❌

The following commits were analyzed and found NOT directly related to the memory leak:

- **69c5bdcf2a** - pass memoryConfig via .network() (config passing only)
- **f76e134553** - fix map to stream chunkt poh (typo fix)
- **e18f1e80bf** - reset workflow event (event handling)
- **e83b2e6c89** - default finishReason on textdelta (default value)
- **405c777070** - Loop events (event types)
- **18fde54e0c** - run workflow from initial state (workflow feature)
- **15e3e34207** - allow stream to take in options (API compatibility)
- **2f8f29f4e5** - pass memory id from workflow (metadata passing)
- **f76ae5dd51** - pass down workflow state (state passing)
- **c76963bb22** - workflow state (state management)
- **9c7f2d1d6b** - workflow vnext (workflow feature)
- **524abce9dc** - Emit output chunks (output feature)
- **3e25af55c4** - Stream workflows (initial streaming)

## Timeline Summary

### Pre v0.13.2 (Working Version)

- **Aug 15, 2025**: ProcessorState with streamParts accumulation (6faaee5908)
- **Aug 26, 2025**: Event-based execution engine (ba82abe76e)

### Between v0.13.2 and v0.21.1 (Regression Introduced)

- **Sep 17, 2025**: Resumable streams (222965a98c)
- **Sep 24, 2025**: Evented stream consumption fix (d3ae6f1334)
- **Sep 24, 2025**: Buffer emit fix (1b0eb147b9)
- **Oct 1, 2025**: 🚨 **Structured output stream processor (bc5aacb646)** - PRIMARY SUSPECT
- **Oct 10, 2025**: Processor tracing (37a23148e0)

## Conclusion

The memory leak was most likely introduced by **bc5aacb646** on Oct 1, 2025, which added EventEmitter-based streaming with unbounded buffer accumulation. This commit introduced the `#bufferedChunks` array that stores all stream chunks for replay capability but never clears them.

Supporting evidence:

1. This is the ONLY commit that introduced EventEmitter to output.ts
2. It explicitly adds buffering for "replay in new streams"
3. The timing matches the regression between v0.13.2 and v0.21.1
4. The buffering pattern matches the observed memory growth

## Next Steps

1. Verify bc5aacb646 is in v0.21.1 but not v0.13.2
2. Test reverting just the buffering changes from bc5aacb646
3. Find a solution that preserves concurrent stream access while preventing unbounded growth
4. Consider if other buffer-related commits compound the issue
