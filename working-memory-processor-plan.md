# Working Memory Processor - Implementation Status

## Current Status: ⚠️ PARTIALLY WORKING

### Critical Issue Discovered

**System Message Injection Does Not Work**

During testing, we discovered a fundamental architectural issue with the 'system' injection strategy:

#### The Problem

1. **ProcessorRunner Architecture Limitation**
   - `ProcessorRunner.runInputProcessors()` (line 307 in `runner.ts`) hardcodes all returned messages as source `'user'`
   - System messages MUST be added via `MessageList.addSystem()`, not `MessageList.add()`
   - When processors return system messages, they get rejected because they're added with wrong source

2. **MessageList Structure**
   - System messages are stored separately in `MessageList.systemMessages` array
   - Regular messages are stored in `MessageList.messages` array
   - `messageList.get.all.v2()` only returns `this.messages`, NOT system messages
   - System messages are only included when calling `messageList.get.all.prompt()` for LLM calls

3. **Evidence from Debug Logs**

   ```
   [WorkingMemoryProcessor.injectContext] After adding system message:
     messageList count: 0           ← No regular messages
     System messages: 1             ← 1 system message (stored separately)

   [WorkingMemoryProcessor.injectContext] After adding user messages:
     messageList count: 1           ← Only user message
     All messages: [{ role: 'user' }]  ← System message not in array!
   ```

### Test Results

**V1 Tests (AI SDK v4):** 7 passed ✅, 1 failed ❌
**V5 Tests (AI SDK v5):** 7 passed ✅, 1 failed ❌

**Failing Test:** "should inject working memory context into conversation"

- Manually sets working memory
- Asks "What is my name?"
- Expected: Agent responds with name from working memory
- Actual: Agent says "I don't know your name yet"
- **Cause**: System message with context never makes it into the message array

### Files Modified in This Session

1. **Core Implementation:**
   - `packages/core/src/processors/processors/working-memory.ts`
     - Added architectural notes about system message limitations
     - Changed default injection strategy from 'system' to 'user-prefix'
     - Added comments documenting the issue

2. **Test Parity:**
   - Both V1 and V5 test suites now have 8 tests (parity achieved)
   - Added 3 tests to V1 that existed in V5:
     - "should manually update and retrieve working memory"
     - "should inject working memory context into conversation"
     - "should inject context without errors (basic smoke test)"

3. **Configuration:**
   - ✅ Both `integration-tests/package.json` and `integration-tests-v5/package.json` have `"type": "module"`
   - ✅ Fixed vitest ESM errors (Vite 7.1.5 is ESM-only)
   - ✅ Both test suites run in CI

---

## Possible Solutions

### Option 1: Change Default Injection Strategy (IMPLEMENTED)

**Status:** ✅ Done - Changed default from 'system' to 'user-prefix'

**Pros:**

- Quick fix that makes processor work immediately
- 'user-prefix' strategy works correctly with current architecture
- Still allows users to explicitly choose 'system' if needed

**Cons:**

- Context injected as part of user message instead of system message
- Less clean separation between instructions and user input
- Changes expected behavior for existing users

### Option 2: Fix ProcessorRunner Architecture

**Change:** Modify `ProcessorRunner.runInputProcessors()` to support system messages

**Approach:**

```typescript
// Instead of returning MastraMessageV2[], return:
interface ProcessorResult {
  messages: MastraMessageV2[];
  systemMessages?: Array<{ role: 'system'; content: string }>;
}

// In ProcessorRunner:
if (processableMessages.length > 0) {
  messageList.add(processableMessages, 'user');
}
if (result.systemMessages?.length) {
  for (const sysMsg of result.systemMessages) {
    messageList.addSystem(sysMsg);
  }
}
```

**Pros:**

- Fixes the root cause
- Enables proper system message injection from processors
- More flexible for future processors

**Cons:**

- Breaking change to Processor interface
- Requires updating all processors
- More complex implementation

### Option 3: Remove 'system' Strategy

**Change:** Remove the 'system' injection strategy entirely, only support 'user-prefix' and 'context'

**Pros:**

- Simplifies code
- Removes non-working functionality
- Forces use of working strategies

**Cons:**

- Reduces flexibility
- May be less semantically correct (context as system message makes more sense)
- Requires documentation updates

### Option 4: Use Agent Instructions Instead

**Change:** Instead of injecting system messages, modify the agent's instructions dynamically

**Approach:**

```typescript
// Processor could return metadata:
interface ProcessorResult {
  messages: MastraMessageV2[];
  additionalInstructions?: string;
}
```

**Pros:**

- More semantically correct (working memory is part of instructions)
- Avoids message injection issues
- Clean separation of concerns

**Cons:**

- Requires significant architectural changes
- Processors don't currently have access to agent instructions
- May not work with all agent configurations

---

## Recommendation

**Short-term (Immediate):**

- ✅ **Use Option 1** - Default to 'user-prefix' strategy (already done)
- Document the limitation of 'system' strategy
- Update tests to use 'user-prefix' or 'context' strategies

**Long-term (Future PR):**

- **Implement Option 2** - Fix ProcessorRunner to properly support system messages
- This provides the most flexibility and fixes the root cause
- Enables other processors to inject system messages if needed

---

## Implementation Details

### Current Test Coverage

**Unit Tests:** 26 tests, all passing ✅

- Located: `packages/core/src/processors/processors/working-memory.test.ts`
- Tests all processor functionality with mocked storage

**Integration Tests V1 (AI SDK v4):** 8 tests

- Located: `packages/memory/integration-tests/src/working-memory-processor.test.ts`
- Tests with real LibSQL storage and OpenAI LLM
- 7 passing ✅, 1 failing ❌ (system injection test)

**Integration Tests V5 (AI SDK v5):** 8 tests

- Located: `packages/memory/integration-tests-v5/src/working-memory-processor.test.ts`
- Tests with real LibSQL storage and OpenAI LLM
- 7 passing ✅, 1 failing ❌ (system injection test)

### Test Parity Achieved

Both V1 and V5 now have identical test coverage:

1. ✅ should remember user name introduced in first message
2. ✅ should accumulate information across multiple conversations
3. ✅ should maintain separate memory for different resources
4. ✅ should work with thread-scoped memory when configured
5. ✅ should handle name changes and updates
6. ✅ should manually update and retrieve working memory
7. ❌ should inject working memory context into conversation (FAILING)
8. ✅ should inject context without errors (basic smoke test)

---

## Next Steps

1. **Update failing test** to use 'user-prefix' strategy instead of default
2. **Rebuild and verify** all tests pass
3. **Document limitation** in code comments and public docs
4. **Create follow-up issue** for Option 2 (fix ProcessorRunner)
5. **Update CLAUDE.md** with testing instructions

---

## Architecture Notes

### How MessageList Works

```typescript
class MessageList {
  private messages: MastraMessageV2[] = [];           // Regular messages
  private systemMessages: CoreSystemMessage[] = [];    // System messages (separate!)

  add(messages, source) {
    // Adds to this.messages
    // Validates that system messages should NOT come through here
  }

  addSystem(message) {
    // Adds to this.systemMessages (separate array)
  }

  get.all.v2() {
    return this.messages;  // Only returns regular messages!
  }

  get.all.prompt() {
    // Combines system messages + regular messages for LLM calls
    return [...this.systemMessages, ...this.messages];
  }
}
```

### How Processors Work

```typescript
interface Processor {
  processInput(args: {
    messages: MastraMessageV2[];
    abort: () => never;
    threadId?: string;
    resourceId?: string;
  }): Promise<MastraMessageV2[]>; // Can only return regular messages!
}
```

### Why System Injection Fails

1. Processor creates MessageList and adds system message via `addSystem()`
2. System message goes into `MessageList.systemMessages` array
3. Processor returns `messageList.get.all.v2()` which only has regular messages
4. System message is lost!
5. Agent never sees the working memory context

### Working Strategies

**'user-prefix' Strategy:** ✅ WORKS

```typescript
// Modifies the user message content directly
messages[lastUserIndex] = {
  role: 'user',
  content: `Context: ${workingMemory}\n\n${originalMessage}`,
};
```

**'context' Strategy:** ✅ WORKS

```typescript
// Inserts a separate user message before the actual user message
messages.splice(lastUserIndex, 0, {
  role: 'user',
  content: `[Context]: ${workingMemory}`,
});
```

**'system' Strategy:** ❌ BROKEN

```typescript
// Tries to add system message but it gets lost
messageList.addSystem({ role: 'system', content: workingMemory });
return messageList.get.all.v2(); // System message not included!
```

---

## Historical Context

### Implementation Journey

1. **Phase 1:** Initial implementation with system injection strategy
2. **Phase 2:** Fixed message format issues (CoreMessage vs MastraMessageV2)
3. **Phase 3:** Discovered MessageList architecture limitation
4. **Phase 4:** Changed default strategy to 'user-prefix' as workaround
5. **Phase 5:** Achieved test parity between V1 and V5
6. **Current:** Documented issue and proposed solutions

### Key Learnings

- Processors cannot inject system messages with current architecture
- MessageList separates system messages from regular messages
- ProcessorRunner hardcodes message source as 'user'
- Need architectural change to properly support system message injection

---

## Files to Update

**When implementing Option 2 (fix ProcessorRunner):**

1. `packages/core/src/processors/index.ts` - Update Processor interface
2. `packages/core/src/processors/runner.ts` - Handle system messages
3. `packages/core/src/processors/processors/working-memory.ts` - Return system messages properly
4. `packages/core/src/processors/processors/working-memory.test.ts` - Add system injection tests
5. Documentation - Update processor development guide
