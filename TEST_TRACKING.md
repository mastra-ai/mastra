# CI Test Tracking - Memory System Refactor

## Current CI Status (as of latest run)

**Branch:** feat/memory-as-processors  
**Overall Status:** Not green

## Failing Checks & Progress

### ✅ Fixed Issues

- **Lint**: Prettier check failed for `packages/core/src/processors/processors/message-history.ts` - FIXED
- **Memory Tests (StreamVNext/AI5)**:
  - `src/agent-memory.test.ts:246`: `TypeError: memory.query is not a function` - FIXED (renamed to `memory.recall`)
  - `src/processors.test.ts:180`: `AssertionError: expected 11 to be less than 11` (ToolCallFilter) - FIXED
- **Memory Tests**:
  - `src/processors.test.ts:220`: `AssertionError: expected to have a length of +0 but got 1` (ToolCallFilter) - FIXED

### 🔴 Remaining Issues

- **Validate examples packages.json** & **Validate peer dependencies**: Infrastructure issues (`npm error code 127`, `patch-package: not found`)
- **Memory Tests (StreamVNext/AI5)**:
  - `src/working-memory.test.ts:334`: `AssertionError: expected '# user information...' to contain 'submarine under the sea'` - INVESTIGATED (LLM behavior issue, not processor bug)
- **Memory Tests**:
  - `src/agent-memory.test.ts:617`: `AssertionError: expected 2 to be 4`
  - `src/working-memory.test.ts:656`: `AssertionError: expected { 'User Information': { ...(10) } } to match object { city: 'Denver', temperature: 75 }`
- **Vercel – mastra-docs-1.x** & **Vercel – mastra-docs**: External failures (logs unavailable)

## Debugging Notes

### ToolCallFilter Fix (processors.test.ts:180 & 220)

- **Issue**: Test expected message count reduction but `ToolCallFilter` only filtered tool parts, not entire messages
- **Root Cause**: Test data had messages with both text and tool parts; filtering tool parts left text parts
- **Solution**: Updated test assertions to check total part count reduction and specific tool removal
- **Files Modified**:
  - `packages/core/src/processors/processors/tool-call-filter.ts` (fixed logic for tool results without calls)
  - `packages/memory/integration-tests-v5/src/processors.test.ts` (updated assertions)
  - `packages/memory/integration-tests/src/processors.test.ts` (updated assertions)

### Working Memory Test Investigation (working-memory.test.ts:334)

- **Issue**: Test expected LLM to preserve location info when updating name, but it didn't
- **Investigation**: Created unit test `working-memory-processor.test.ts` to verify processor behavior
- **Finding**: `WorkingMemory` processor works correctly - injects working memory as system message
- **Root Cause**: LLM behavior issue - `updateWorkingMemoryTool` states "Any data not included will be overwritten"
- **Status**: Test design issue, not a processor bug

## Next Actions

1. Debug `src/agent-memory.test.ts:617` - `AssertionError: expected 2 to be 4`
2. Debug `src/working-memory.test.ts:656` - `AssertionError: expected { 'User Information': { ...(10) } } to match object { city: 'Denver', temperature: 75 }`
3. Address infrastructure validation issues if needed
4. Push changes and monitor CI after local fixes pass
