# PR Recovery Plan: Memory as Processors

## Current Situation
We're fixing a PR that refactors Mastra's memory system to use processors. The PR has good changes but also introduced architectural issues that broke output processor execution.

## Core Problem
Output processors in `agent.generate()` calls aren't modifying the response because we moved their execution to the wrong place (`#executeOnFinish` which runs AFTER the response is created).

## Analysis

### ✅ What We Did Right

#### 1. Memory Processor Implementation
- Created `MessageHistory`, `SemanticRecall`, `WorkingMemory` processors in `@mastra/memory`
- These implement the `InputProcessor` interface correctly
- Tests are comprehensive and passing locally
- Correctly moved processors from `@mastra/core` to `@mastra/memory`

#### 2. Memory API Refactoring
- Deprecated old APIs: `memory.processors` config, `processMessages()`, `getMemoryMessages()`, `Memory.rememberMessages`
- Renamed `Memory.query` to `recall`
- Updated `StorageGetMessagesArg` to `StorageListMessagesInput`
- Clean deprecation with proper warnings

#### 3. Support Infrastructure
- Added `MessageList.removeByIds()` public API (needed by processors)
- Updated `MockMemory` to accept processors as constructor params (avoids circular deps)
- Added `runtimeContext` support for passing thread/resource IDs to processors

#### 4. Integration Tests
- Created comprehensive integration tests in `packages/memory/integration-tests-v5/`
- Tests cover all processor behaviors
- Tests are passing locally

### ❌ What We Did Wrong

#### 1. Output Processor Execution Architecture
**The Big Mistake**: We moved output processor execution from the streaming loop to `#executeOnFinish`

**What we changed**:
```javascript
// WRONG: We removed this from output.ts streaming loop
if (self.processorRunner && !self.#options.isLLMExecutionStep) {
  self.messageList = await self.processorRunner.runOutputProcessors(...)
  // Update response with processed messages
}

// WRONG: We added this to agent.ts #executeOnFinish
if (!outputProcessorsRan) {
  messageList = await this.__runOutputProcessors(...)
}
```

**Why it's wrong**: 
- `#executeOnFinish` runs AFTER the `response` object is already created
- So output processors can't modify the response that gets returned
- `main` has it right: processors run DURING streaming, BEFORE response is finalized

#### 2. Processor Interface Over-Extension
**Problem**: Made parameters required when they should be optional
- Added `messageList` as REQUIRED parameter (should be optional)
- Added `runtimeContext` as REQUIRED (should be optional)
- This broke compatibility with existing processors

#### 3. Core Processor Modifications
**Problem**: Removed functionality from existing processors
- Removed `processInput` from `TokenLimiter` in `@mastra/core`
- This is a breaking change for existing users
- Should have kept existing functionality intact

#### 4. Files That Shouldn't Have Changed
- `packages/core/src/processors/processors/token-limiter.ts` - removed `processInput` method
- `packages/core/src/stream/base/output.ts` - removed output processor execution
- `packages/core/src/agent/agent.ts` - added output processor calls in wrong place

### 🎯 What We Need to Keep From Our Branch

1. **All Memory Processors** (`packages/memory/src/processors/`)
   - `message-history.ts` - fetches historical messages
   - `semantic-recall.ts` - adds semantically similar messages
   - `working-memory.ts` - manages conversation context
   - All their comprehensive tests

2. **Memory Package Refactoring** (`packages/memory/src/index.ts`)
   - New processor-based architecture
   - Deprecated old APIs with warnings
   - `getInputProcessors()` and `getOutputProcessors()` methods

3. **Core Memory Types** (`packages/core/src/memory/types.ts`)
   - Updated interfaces removing deprecated fields
   - New processor-based types

4. **MockMemory Updates** (`packages/core/src/memory/mock.ts`)
   - Constructor accepting input/output processors
   - Avoids circular dependencies

5. **MessageList API** (`packages/core/src/agent/message-list/index.ts`)
   - `removeByIds()` public method for processors to use

6. **Agent Legacy Updates** (`packages/core/src/agent/agent-legacy.ts`)
   - Updated to work with new memory API
   - Removed calls to deprecated methods

7. **New Core Processors** (`packages/core/src/processors/processors/`)
   - `tool-call-filter.ts` and its tests
   - Used by memory processors for filtering

8. **All Integration Tests** (`packages/memory/integration-tests-v5/`)
   - Comprehensive test coverage
   - Tests for all processor behaviors

9. **Test Utilities** (`packages/core/src/agent/test-utils.ts`)
   - Updates for testing processor-based memory

### 🔄 What We Need to Restore From Main

1. **Output Processor Execution** (`packages/core/src/stream/base/output.ts`)
   - Keep execution in streaming loop
   - Don't move to `#executeOnFinish`

2. **Agent.ts** (`packages/core/src/agent/agent.ts`)
   - Remove our added `__runOutputProcessors` calls from `#executeOnFinish`
   - Keep `main`'s approach

3. **TokenLimiter** (`packages/core/src/processors/processors/token-limiter.ts`)
   - Restore `processInput` method
   - Keep all existing functionality

## The Execution Plan

### Phase 1: Restore Core Files from Main
**Goal**: Get back to `main`'s working output processor architecture

1. Restore from `main`:
   ```bash
   git checkout origin/main -- packages/core/src/stream/base/output.ts
   git checkout origin/main -- packages/core/src/agent/agent.ts
   git checkout origin/main -- packages/core/src/processors/processors/token-limiter.ts
   ```

2. This will restore:
   - Output processor execution in streaming loop
   - No output processor calls in `#executeOnFinish`
   - TokenLimiter with `processInput` method

### Phase 2: Minimal Interface Extensions
**Goal**: Add only the optional parameters our memory processors need

1. Update `packages/core/src/processors/index.ts`:
   ```typescript
   export interface Processor {
     processInput?(args: {
       messages: MastraDBMessage[];
       messageList?: MessageList;  // ADD: optional
       abort: (reason?: string) => never;
       tracingContext?: TracingContext;
       runtimeContext?: RequestContext;  // ADD: optional
     }): Promise<MastraDBMessage[] | MessageList> | MastraDBMessage[] | MessageList;  // CHANGE: allow MessageList return
     
     processOutputResult?(args: {
       messages: MastraDBMessage[];
       messageList?: MessageList;  // ADD: optional
       abort: (reason?: string) => never;
       tracingContext?: TracingContext;
       runtimeContext?: RequestContext;  // ADD: optional
     }): Promise<MastraDBMessage[] | MessageList> | MastraDBMessage[] | MessageList;  // CHANGE: allow MessageList return
   }
   ```

### Phase 3: Update ProcessorRunner
**Goal**: Make runner pass optional params and handle MessageList returns

1. Update `packages/core/src/processors/runner.ts`:
   - In `runInputProcessors()`:
     ```typescript
     const result = await processMethod({
       messages: processableMessages,
       messageList,  // ADD: pass messageList
       abort: ctx.abort,
       tracingContext: { currentSpan: processorSpan },
       runtimeContext: ctx.runtimeContext,  // ADD: pass runtimeContext
     });
     
     // Handle return type
     if (result instanceof MessageList) {
       processableMessages = result.get.all.db();
     } else {
       processableMessages = result;
     }
     ```
   - Same pattern for `runOutputProcessors()`

### Phase 4: Fix Agent-Legacy
**Goal**: Ensure agent-legacy.ts works with new memory API

1. Keep our version that removes calls to deprecated methods
2. Verify it compiles with the restored files

### Phase 5: Verify Everything Works
**Goal**: Ensure all tests pass

1. **Build packages**:
   ```bash
   pnpm run build:core && pnpm run build:memory
   ```

2. **Run core processor tests**:
   ```bash
   cd packages/core
   pnpm test src/agent/agent-processor.test.ts
   ```
   - All output processor tests should pass

3. **Run memory processor tests**:
   ```bash
   cd packages/memory
   pnpm test src/processors/
   ```

4. **Run integration tests**:
   ```bash
   cd packages/memory/integration-tests-v5
   pnpm test
   ```

### Phase 6: Final Verification and CI
**Goal**: Get everything passing in CI

1. **Local verification**:
   ```bash
   pnpm run lint
   pnpm run build
   pnpm test  # run targeted tests, not all
   ```

2. **Commit with clear message**:
   ```bash
   git add -A
   git commit -m "fix: restore main's output processor architecture while keeping memory refactoring

   - Restore output processor execution in streaming loop from main
   - Keep memory processor refactoring and new processors
   - Add optional messageList and runtimeContext params to interface
   - Handle MessageList return type in ProcessorRunner"
   ```

3. **Push and monitor CI**:
   ```bash
   git push
   gh pr checks --watch
   ```

4. **Fix any CI-specific issues**:
   - Check for flaky tests
   - Address any environment-specific failures

## Success Criteria

1. ✅ `agent-processor.test.ts` - all tests passing
2. ✅ Memory processors work correctly
3. ✅ Integration tests passing
4. ✅ No breaking changes to existing processors
5. ✅ CI green
6. ✅ PR ready to merge

## Key Principles

1. **Minimal Changes**: Only change what's necessary for memory processors
2. **Backward Compatible**: Don't break existing functionality
3. **Test-Driven**: Verify each change with tests
4. **Main's Architecture**: Keep output processor execution where `main` has it
5. **Optional Parameters**: New params should be optional to maintain compatibility

## Common Pitfalls to Avoid

1. ❌ Don't move output processor execution out of streaming loop
2. ❌ Don't make new parameters required
3. ❌ Don't remove existing processor functionality
4. ❌ Don't modify files that don't need changes
5. ❌ Don't add complex state tracking (like `outputProcessorsRan` flag)

## Questions to Answer Before Starting

1. Do we agree that output processors should run in the streaming loop?
2. Do we agree that new parameters should be optional?
3. Do we agree to keep TokenLimiter's `processInput` method?
4. Are there any other processors we modified that need restoration?
5. Is there anything missing from this plan?