# Memory Refactoring: Remove Scattered Logic & Complete Processor Migration

## Problem Statement

We have **duplicate message history logic** running in parallel:

1. **OLD PATH (currently active)**:
   - `prepare-memory-step.ts` → `capabilities.getMemoryMessages()` → `memory.rememberMessages()` → fetches history
   - Includes semantic recall mixed in
   - Uses old `memory.processMessages()` with deprecated MemoryProcessors

2. **NEW PATH (our processors)**:
   - `MessageHistory.processInput()` → `storage.getMessages()` → fetches history
   - Clean separation of concerns
   - Uses new Input/Output processor system

**Result**: History is fetched twice, old processors still run, new processors are redundant.

## Goals

1. ✅ Remove ALL scattered memory logic from `prepare-memory-step.ts`
2. ✅ Make processors the ONLY way memory fetching/saving happens
3. ✅ Deprecate `processors` config option in Memory with clear error message
4. ✅ Ensure all existing memory tests pass
5. ✅ Maintain backward compatibility for public API

## Phase 1: Add Deprecation Error for `processors` Config

### Changes Required

**File**: `packages/core/src/memory/memory.ts`

```typescript
constructor(config: { name: string } & SharedMemoryConfig) {
  super({ component: 'MEMORY', name: config.name });

  // DEPRECATION: Block old processors config
  if (config.processors) {
    throw new Error(
      `The 'processors' option in Memory is deprecated and has been removed.

Please use the new Input/Output processor system instead:

OLD (deprecated):
  new Memory({
    processors: [new TokenLimiter(100000)]
  })

NEW (use this):
  new Agent({
    memory,
    outputProcessors: [
      new TokenLimiterProcessor(100000)
    ]
  })

Or pass memory directly to processor arrays:
  new Agent({
    inputProcessors: [memory],
    outputProcessors: [memory]
  })

See: https://mastra.ai/en/docs/memory/processors`
    );
  }

  // ... rest of constructor
}
```

**File**: `packages/core/src/memory/types.ts`

```typescript
/**
 * @deprecated Use Input/Output processors instead. This option will throw an error if used.
 * See https://mastra.ai/en/docs/memory/processors
 */
processors?: MemoryProcessor[];
```

## Phase 2: Refactor `prepare-memory-step.ts` to Remove Scattered Logic

### Current Flow (BEFORE)

```typescript
// Lines 173-184: OLD - Fetch memory messages separately
let [memoryMessages, memorySystemMessage] = await Promise.all([
  existingThread || hasResourceScopeSemanticRecall
    ? capabilities.getMemoryMessages({  // ← DUPLICATE FETCH
        resourceId,
        threadId: threadObject.id,
        vectorMessageSearch: ...,
        memoryConfig,
        runtimeContext,
      })
    : [],
  memory.getSystemMessage({ ... }),
]);

// Lines 230-235: Add fetched messages to messageList
messageList
  .add(memoryMessages.filter(...), 'memory')
  .add(options.messages, 'user');

// Lines 249-254: OLD - Process with deprecated MemoryProcessors
const processedMemoryMessages = await memory.processMessages({
  messages: messageList.get.remembered.v1() as any,
  newMessages: messageList.get.input.v1() as any,
  systemMessage,
  memorySystemMessage: memorySystemMessage || undefined,
});
```

### New Flow (AFTER)

```typescript
// Set memory context in RuntimeContext EARLY (before processors run)
runtimeContext.set('MastraMemory', {
  thread: threadObject,
  resourceId,
});

// Build message list with ONLY new user messages
messageList.add(options.context || [], 'context').add(options.messages, 'user');

// Add user-provided system message if present
addSystemMessage(messageList, options.system, 'user-provided');

// Run input processors - MessageHistory will fetch and prepend history
const { tripwireTriggered, tripwireReason } = await capabilities.runInputProcessors({
  runtimeContext,
  tracingContext,
  messageList,
});

// That's it! No manual memory fetching, no processMessages()
// Processors handle everything:
// - MessageHistory fetches and prepends history
// - SemanticRecall adds semantic context
// - WorkingMemory injects working memory system message
```

### Detailed Changes

**File**: `packages/core/src/agent/workflows/prepare-stream/prepare-memory-step.ts`

#### Change 1: Remove `capabilities.getMemoryMessages()` call

**REMOVE** lines 173-184:

```typescript
let [memoryMessages, memorySystemMessage] = await Promise.all([
  existingThread || hasResourceScopeSemanticRecall
    ? capabilities.getMemoryMessages({
        resourceId,
        threadId: threadObject.id,
        vectorMessageSearch: new MessageList().add(options.messages, `user`).getLatestUserContent() || '',
        memoryConfig,
        runtimeContext,
      })
    : [],
  memory.getSystemMessage({ threadId: threadObject.id, resourceId, memoryConfig }),
]);
```

**REPLACE** with:

```typescript
// Working memory system message (if configured)
const memorySystemMessage = await memory.getSystemMessage({
  threadId: threadObject.id,
  resourceId,
  memoryConfig,
});
```

#### Change 2: Remove manual message list building

**REMOVE** lines 186-235 (all the manual message formatting and adding):

```typescript
capabilities.logger.debug('Fetched messages from memory', {
  threadId: threadObject.id,
  runId,
  fetchedCount: memoryMessages.length,
});

// Handle messages from other threads
const resultsFromOtherThreads = memoryMessages.filter((m: any) => m.threadId !== threadObject.id);
// ... lots of formatting code ...

messageList
  .add(
    memoryMessages.filter((m: any) => m.threadId === threadObject.id),
    'memory',
  )
  .add(options.messages, 'user');
```

**REPLACE** with:

```typescript
// Add new user messages only - processors will handle history
messageList.add(options.messages, 'user');
```

#### Change 3: Remove `memory.processMessages()` call

**REMOVE** lines 249-275:

```typescript
const processedMemoryMessages = await memory.processMessages({
  messages: messageList.get.remembered.v1() as any,
  newMessages: messageList.get.input.v1() as any,
  systemMessage,
  memorySystemMessage: memorySystemMessage || undefined,
});

const processedList = new MessageList({
  threadId: threadObject.id,
  resourceId,
  generateMessageId: capabilities.generateMessageId,
  _agentNetworkAppend: capabilities._agentNetworkAppend,
});

// Add instructions as system message(s)
addSystemMessage(processedList, instructions);

processedList
  .addSystem(memorySystemMessage)
  .addSystem(systemMessages)
  .add(options.context || [], 'context');

// Add user-provided system message if present
addSystemMessage(processedList, options.system, 'user-provided');

processedList.add(processedMemoryMessages, 'memory').add(messageList.get.input.v2(), 'user');
```

**REPLACE** with:

```typescript
// Processors have already modified messageList in-place
// Just return it as-is
```

#### Change 4: Complete refactored flow

**NEW FLOW** (lines 164-242):

```typescript
// Set memory context in RuntimeContext for processors to access
runtimeContext.set('MastraMemory', {
  thread: threadObject,
  resourceId,
});

// Get working memory system message (if configured)
const memorySystemMessage = await memory.getSystemMessage({
  threadId: threadObject.id,
  resourceId,
  memoryConfig,
});

// Build message list with instructions and context
const messageList = new MessageList({
  threadId: thread?.id,
  resourceId,
  generateMessageId: capabilities.generateMessageId,
  _agentNetworkAppend: capabilities._agentNetworkAppend,
});

// Add instructions as system message(s)
addSystemMessage(messageList, instructions);

// Add working memory system message if present
if (memorySystemMessage) {
  messageList.addSystem(memorySystemMessage, 'memory');
}

// Add context messages
messageList.add(options.context || [], 'context');

// Add user-provided system message if present
addSystemMessage(messageList, options.system, 'user-provided');

// Add new user messages
messageList.add(options.messages, 'user');

// Run input processors - this is where ALL memory logic happens:
// - MessageHistory fetches and prepends historical messages
// - SemanticRecall adds semantic context (if configured)
// - WorkingMemory injects working memory (if configured)
const { tripwireTriggered, tripwireReason } = await capabilities.runInputProcessors({
  runtimeContext,
  tracingContext,
  messageList,
});

return {
  thread: threadObject,
  messageList, // Processors have modified this in-place
  ...(tripwireTriggered && {
    tripwire: true,
    tripwireReason,
  }),
  threadExists: !!existingThread,
};
```

## Phase 3: Update Agent to Remove `getMemoryMessages()` Method

**File**: `packages/core/src/agent/agent.ts`

**REMOVE** method at lines 1653-1679:

```typescript
private async getMemoryMessages({
  resourceId,
  threadId,
  vectorMessageSearch,
  memoryConfig,
  runtimeContext,
}: {
  resourceId?: string;
  threadId: string;
  vectorMessageSearch: string;
  memoryConfig?: MemoryConfig;
  runtimeContext: RuntimeContext;
}) {
  const memory = await this.getMemory({ runtimeContext });
  if (!memory) {
    return [];
  }
  return memory
    .rememberMessages({
      threadId,
      resourceId,
      config: memoryConfig,
      vectorMessageSearch,
    })
    .then(r => r.messagesV2);
}
```

**REMOVE** from capabilities (line 3513):

```typescript
getMemoryMessages: this.getMemoryMessages.bind(this),
```

**File**: `packages/core/src/agent/workflows/prepare-stream/schema.ts`

**REMOVE** from `AgentCapabilities` interface:

```typescript
getMemoryMessages: (args: {
  resourceId?: string;
  threadId: string;
  vectorMessageSearch: string;
  memoryConfig?: MemoryConfig;
  runtimeContext: RuntimeContext;
}) => Promise<MastraMessageV2[]>;
```

## Phase 4: Deprecate `memory.processMessages()` Method

**File**: `packages/core/src/memory/memory.ts`

```typescript
/**
 * @deprecated This method is deprecated and will be removed in a future version.
 * Memory processing now happens automatically through Input/Output processors.
 * Use the new processor system instead.
 */
abstract processMessages(args: {
  messages: MastraMessageV1[];
  newMessages: MastraMessageV1[];
  systemMessage?: string;
  memorySystemMessage?: string;
}): Promise<MastraMessageV1[]>;
```

**File**: `packages/memory/src/index.ts`

```typescript
async processMessages(args: {
  messages: MastraMessageV1[];
  newMessages: MastraMessageV1[];
  systemMessage?: string;
  memorySystemMessage?: string;
}): Promise<MastraMessageV1[]> {
  console.warn(
    'DEPRECATION WARNING: memory.processMessages() is deprecated. ' +
    'Memory processing now happens automatically through Input/Output processors. ' +
    'This method will be removed in a future version.'
  );

  // Keep existing implementation for backward compatibility
  // ... existing code ...
}
```

## Phase 5: Update Memory to Provide Processors

**File**: `packages/core/src/memory/memory.ts`

Uncomment and complete the processor provider methods:

```typescript
/**
 * Returns input processors configured for this memory instance.
 * These processors run BEFORE the LLM to prepare context.
 */
getInputProcessors(): InputProcessor[] {
  const processors: InputProcessor[] = [];

  // Always add message history processor if storage is configured
  if (this._storage) {
    processors.push(new MessageHistory({
      storage: this.storage,
      lastMessages: this.threadConfig.lastMessages,
      includeSystemMessages: false,
    }));
  }

  // Add semantic recall if configured
  if (this.threadConfig.semanticRecall && this.vector && this.embedder) {
    const semanticConfig = typeof this.threadConfig.semanticRecall === 'object'
      ? this.threadConfig.semanticRecall
      : {};

    processors.push(new SemanticRecall({
      storage: this.storage,
      vector: this.vector,
      embedder: this.embedder,
      topK: semanticConfig.topK,
      messageRange: semanticConfig.messageRange,
      scope: semanticConfig.scope || 'thread',
      threshold: semanticConfig.threshold,
      indexName: semanticConfig.indexName,
    }));
  }

  // Add working memory input processor if configured
  if (this.threadConfig.workingMemory) {
    processors.push(new WorkingMemory({
      storage: this.storage,
      template: this.threadConfig.workingMemory.template,
      scope: this.threadConfig.workingMemory.scope || 'thread',
      useVNext: this.threadConfig.workingMemory.useVNext,
    }));
  }

  return processors;
}

/**
 * Returns output processors configured for this memory instance.
 * These processors run AFTER the LLM to handle persistence.
 */
getOutputProcessors(): OutputProcessor[] {
  const processors: OutputProcessor[] = [];

  // Always add message persistence if storage is configured
  if (this._storage) {
    processors.push(new MessageHistory({
      storage: this.storage,
      lastMessages: this.threadConfig.lastMessages,
      includeSystemMessages: false,
    }));
  }

  // Note: WorkingMemory extraction happens via tools, not output processors
  // The LLM calls updateWorkingMemory tool to update working memory

  return processors;
}
```

## Phase 6: Test Strategy

### Unit Tests to Update

1. **MessageHistory processor tests** - Already passing ✅
2. **SemanticRecall processor tests** - Already passing ✅
3. **WorkingMemory processor tests** - Already passing ✅

### Integration Tests to Run

**File**: `packages/memory/integration-tests/src/agent-memory.test.ts`

- Test basic memory persistence
- Test message retrieval
- Test thread management

**File**: `packages/memory/integration-tests/src/processors.test.ts`

- Test old MemoryProcessor system (should still work via deprecated path)
- Add tests for new processor system

**File**: `packages/memory/integration-tests/src/working-memory.test.ts`

- Test working memory injection
- Test working memory updates

**File**: `packages/memory/integration-tests/src/streaming-memory.test.ts`

- Test memory with streaming responses

### New Integration Tests to Add

**File**: `packages/memory/integration-tests/src/new-processor-system.test.ts`

```typescript
describe('Memory with New Processor System', () => {
  test('memory provides input processors', async () => {
    const memory = new Memory({
      lastMessages: 10,
      semanticRecall: true,
      workingMemory: { template: '...' },
    });

    const inputProcessors = memory.getInputProcessors();
    expect(inputProcessors).toHaveLength(3); // MessageHistory, SemanticRecall, WorkingMemory
  });

  test('memory provides output processors', async () => {
    const memory = new Memory({});
    const outputProcessors = memory.getOutputProcessors();
    expect(outputProcessors).toHaveLength(1); // MessageHistory
  });

  test('agent with memory in processor arrays', async () => {
    const memory = new Memory({ lastMessages: 5 });
    const agent = new Agent({
      inputProcessors: [memory],
      outputProcessors: [memory],
    });

    // Should expand memory into its processors
    // Test that history is fetched and saved correctly
  });

  test('processors config throws error', () => {
    expect(() => {
      new Memory({
        processors: [new TokenLimiter(100000)],
      });
    }).toThrow("processors' option in Memory is deprecated");
  });

  test('memory fetching happens only once via processors', async () => {
    const storageSpy = jest.spyOn(storage, 'getMessages');

    const memory = new Memory({ lastMessages: 10 });
    const agent = new Agent({ memory });

    await agent.generate('Hello');

    // Should only fetch messages ONCE (via MessageHistory processor)
    expect(storageSpy).toHaveBeenCalledTimes(1);
  });
});
```

## Phase 7: Verification Checklist

- [ ] `processors` config throws clear deprecation error
- [ ] `prepare-memory-step.ts` has NO memory fetching logic
- [ ] `memory.processMessages()` shows deprecation warning
- [ ] `getMemoryMessages()` method removed from Agent
- [ ] All existing memory integration tests pass
- [ ] New processor system tests pass
- [ ] Prettier passes
- [ ] Linting passes
- [ ] Build passes
- [ ] No duplicate message fetching (verify with spy)

## Migration Guide for Users

### Before (Old Way)

```typescript
const memory = new Memory({
  lastMessages: 10,
  processors: [new TokenLimiter(100000), new ToolCallFilter()],
});

const agent = new Agent({ memory });
```

### After (New Way - Option 1: Direct memory)

```typescript
const memory = new Memory({
  lastMessages: 10,
});

const agent = new Agent({
  memory,
  outputProcessors: [new TokenLimiterProcessor(100000)],
});
```

### After (New Way - Option 2: Processor arrays)

```typescript
const memory = new Memory({
  lastMessages: 10,
});

const agent = new Agent({
  inputProcessors: [memory], // Expands to memory.getInputProcessors()
  outputProcessors: [
    memory, // Expands to memory.getOutputProcessors()
    new TokenLimiterProcessor(100000),
  ],
});
```

### After (New Way - Option 3: Manual processors)

```typescript
const memory = new Memory({
  lastMessages: 10,
  semanticRecall: true,
  workingMemory: { template: '...' },
});

const agent = new Agent({
  inputProcessors: [
    ...memory.getInputProcessors(), // MessageHistory, SemanticRecall, WorkingMemory
    new CustomInputProcessor(),
  ],
  outputProcessors: [
    new CustomOutputProcessor(),
    ...memory.getOutputProcessors(), // MessageHistory
  ],
});
```

## Success Criteria

1. ✅ Zero duplicate memory fetching
2. ✅ All memory logic happens via processors
3. ✅ Clear deprecation errors for old patterns
4. ✅ All existing tests pass
5. ✅ New processor system fully functional
6. ✅ Backward compatibility maintained (with warnings)
7. ✅ Clean, maintainable code with no scattered logic
