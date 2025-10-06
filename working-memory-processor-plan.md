# Working Memory Processor - Plan and Implementation

## Overview

A bidirectional processor that automatically manages working memory by:

1. **Input Processing**: Enriches user messages with relevant context from working memory
2. **Output Processing**: Captures and stores important information from conversations

**Status**: ✅ IMPLEMENTED in `/packages/core/src/processors/processors/working-memory.ts`

## Goals

1. Automatically inject relevant working memory context into user messages
2. Detect and extract important information from both user inputs and agent outputs
3. Update working memory without requiring explicit tool calls
4. Support both markdown and JSON working memory formats
5. Seamlessly integrate with the existing processor pipeline
6. Provide intelligent context injection based on message content

## Design Approach

### 1. Processor Responsibilities

#### Input Processing (User → Agent)

- **Analyze user messages**: Understand what the user is asking about
- **Query working memory**: Retrieve relevant stored information
- **Inject context**: Add working memory context to messages
- **Smart retrieval**: Use semantic search or keyword matching to find relevant memory
- **Context formatting**: Format memory as system messages or context prefixes

#### Output Processing (Agent → User)

- **Process output messages**: Analyze assistant messages for important information
- **Extract from user inputs**: Also capture important info from user messages
- **Extract key information**: Identify facts, preferences, context worth remembering
- **Update working memory**: Automatically update the memory system
- **Maintain context**: Preserve conversation flow without interrupting

### 2. Information Detection Strategy

#### For Input Processing

- **Context Relevance Detection**:
  - Analyze user query for topics/entities
  - Match against working memory sections
  - Use semantic similarity for fuzzy matching
  - Consider recency and frequency of memory items

#### For Output Processing

- **Information Extraction**:
  - Use an internal agent (similar to moderation processor) to analyze outputs
  - Look for patterns indicating memorable information:
    - User preferences and personal details
    - Important facts and data points
    - Task-related context and state
    - Decisions and conclusions
    - Action items and future references
  - Extract from both user and assistant messages

### 3. Working Memory Integration

- Access the Memory instance through processor configuration
- Use the Memory's methods:
  - `updateWorkingMemory()` for direct updates
  - `__experimental_updateWorkingMemoryVNext()` for smart append/replace with deduplication
  - `getWorkingMemory()` to read current state
  - `getWorkingMemoryTemplate()` to understand structure
- Support both thread-scoped and resource-scoped working memory
- Handle both markdown and JSON templates

### 4. Configuration Options

**IMPORTANT UPDATE**: The actual implementation uses `storage: MastraStorage` instead of `memory: Memory` and automatically passes `threadId` and `resourceId` from the ProcessorRunner.

```typescript
interface WorkingMemoryProcessorOptions {
  /**
   * Storage adapter for persisting working memory.
   * Must implement MastraStorage interface (getThreadById, updateThread, etc.)
   * NOTE: Implementation uses storage directly, not Memory instance
   */
  storage: MastraStorage;

  /**
   * Language model used by the internal extraction agent to analyze content
   * and determine what information should be stored in working memory.
   * Should be a capable model (e.g., GPT-4, Claude) for best results.
   */
  model: MastraLanguageModel;

  /**
   * Working memory scope:
   * - 'thread': Store memory per thread
   * - 'resource': Store memory per resource (default)
   * NOTE: threadId and resourceId are now passed automatically by ProcessorRunner
   */
  scope?: WorkingMemoryScope;

  /**
   * Working memory template defining the structure.
   * Can be a markdown template or JSON schema.
   * Default: Simple markdown template for user preferences
   */
  template?: WorkingMemoryTemplate;

  // ============= Input Processing Options =============
  // NOTE: enableInputProcessing/enableOutputProcessing were NOT implemented
  // Both modes are always active in the current implementation

  /**
   * Strategy for injecting working memory into messages:
   * - 'system': Add as a system message (default)
   * - 'user-prefix': Prepend to user message
   * - 'context': Add as separate context message
   * - 'smart': Decide based on message content
   */
  injectionStrategy?: 'system' | 'user-prefix' | 'context' | 'smart';

  /**
   * Maximum amount of working memory to inject (in characters).
   * Prevents overwhelming the context window.
   * Default: 2000 characters
   */
  maxInjectionSize?: number;

  /**
   * Minimum relevance score (0-1) for context injection.
   * Only inject memory sections scoring above this threshold.
   * Default: 0.3
   */
  injectionThreshold?: number;

  /**
   * Custom instructions for the context selection agent.
   * Guide what memory is considered relevant for injection.
   */
  contextSelectionInstructions?: string;

  // ============= Output Processing Options =============

  /**
   * Strategy for how aggressively the processor extracts information:
   * - 'aggressive': Captures most details, even potentially ephemeral ones
   * - 'conservative': Only captures clearly important, long-term information
   * - 'balanced': Default - moderate threshold for what to remember
   *
   * Affects the extraction agent's instructions and confidence threshold.
   */
  extractionStrategy?: 'aggressive' | 'conservative' | 'balanced';

  /**
   * Whether to extract information from user messages too.
   * When true, analyzes user inputs for memorable information.
   * Default: true
   */
  extractFromUserMessages?: boolean;

  /**
   * Custom instructions for the extraction agent to override defaults.
   * Use this to provide domain-specific guidance on what to remember.
   * Example: "Focus on medical history and symptoms" for healthcare apps.
   * These instructions will be appended to the base extraction prompt.
   */
  extractionInstructions?: string;

  /**
   * Whether to include the extraction agent's reasoning in debug logs.
   * Useful for understanding why certain information was or wasn't stored.
   * Default: false to minimize log verbosity.
   */
  includeReasoning?: boolean;

  /**
   * Minimum confidence score (0-1) for extraction decisions.
   * The extraction agent returns confidence scores for each piece of info.
   * Only information scoring above this threshold will be stored.
   * Default values:
   * - aggressive: 0.3
   * - balanced: 0.5
   * - conservative: 0.7
   * Can be overridden regardless of strategy.
   */
  confidenceThreshold?: number;
}
```

### 5. Implementation Status

✅ **COMPLETED** - The processor has been fully implemented with the following approach:

#### Key Implementation Details:

**1. Smart Execution Order in `processInput()`:**

- Extracts from user messages FIRST (before injection)
- Updates working memory with new information
- THEN injects the updated memory as context
- This prevents feedback loops and ensures current info is captured

**2. Storage Integration:**

- Uses `storage.stores.memory` directly instead of Memory class
- Supports both thread-scoped (in metadata) and resource-scoped storage
- Defaults to resource scope for cross-conversation persistence

**3. Internal Agents:**

- **Extraction Agent**: Fully implemented and active
- **Context Selection Agent**: Code present but commented out for performance
- Currently injects all working memory when available

**4. Injection Marker System:**

- Uses `[WORKING_MEMORY_INJECTED]` marker to prevent loops
- Checks for marker before processing to avoid re-extraction

**5. Error Handling:**

- All errors are caught and logged (non-blocking)
- Conversations continue even if memory operations fail
- Returns original messages unchanged on error

**6. ProcessorRunner Integration:**

- Modified to pass `threadId` and `resourceId` to all processors
- Processors receive these in their process methods automatically

### 6. Example Usage

```typescript
import { WorkingMemoryProcessor } from '@mastra/core/processors';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core';

// NOTE: Actual implementation uses storage directly, not Memory
const processor = new WorkingMemoryProcessor({
  storage: myStorage as MastraStorage, // Storage adapter
  model: openai('gpt-4o-mini'), // LLM for agents
  scope: 'resource', // Default: resource scope
  template: {
    // Optional template
    format: 'markdown',
    content: `# User Info\n- Name:\n- Preferences:`,
  },
  injectionStrategy: 'system', // How to inject context
  maxInjectionSize: 2000, // Truncate if too large
  extractionStrategy: 'balanced', // Extraction aggressiveness
  extractFromUserMessages: true, // Also extract from user input
  confidenceThreshold: 0.5, // Min confidence to store
});

// Use with agent - threadId/resourceId passed automatically
const agent = new Agent({
  name: 'my-agent',
  model: openai('gpt-4o-mini'),
  memory, // For conversation history
  inputProcessors: [processor], // Extraction + injection
  outputProcessors: [processor], // Extraction from responses
});

// In use - processor handles everything automatically
await agent.generate('My name is Alice', {
  memory: { thread: threadId, resource: resourceId },
});
// Processor extracts "Alice" and stores in working memory

await agent.generate('What is my name?', {
  memory: { thread: threadId, resource: resourceId },
});
// Processor injects context, agent knows name is "Alice"
```

### 7. Test Coverage Analysis & Consolidation Plan

**Status**: ✅ Comprehensive test coverage (2,482 lines of tests across 6 files)

#### Current Test Files:

**Unit Tests (Core Package):**

1. `packages/core/src/processors/processors/working-memory.test.ts` (630 lines)
   - Input Processing (Extract and Inject) - 6 tests
   - Output Processing (Information Extraction) - 5 tests
   - Configuration Options - 4 tests
   - Error Handling - 2 tests
2. `packages/core/src/processors/processors/working-memory-comprehensive.test.ts` (813 lines)
   - Multi-turn Conversation Flow - 3 tests
   - Duplicate Detection - 2 tests
   - Assistant Response Processing - 2 tests
   - Resource vs Thread Scope - 2 tests
   - Template Formats - 1 test
   - Context Injection Strategies - 1 test
   - Extraction Strategies - 2 tests
   - Feedback Loop Prevention - 1 test

**Integration Tests (V5 - AI SDK v5):** 3. `packages/memory/integration-tests-v5/src/working-memory-processor.test.ts` (413 lines)

- Remember user name - 1 test
- Accumulate information - 1 test
- Separate resource memory - 1 test
- Thread-scoped memory - 1 test
- Handle name changes - 1 test

4. `packages/memory/integration-tests-v5/src/working-memory-processor-basic.test.ts` (139 lines)
   - Manual update/retrieve - 1 test
   - Inject context - 1 test

5. `packages/memory/integration-tests-v5/src/working-memory-injection.test.ts` (95 lines)
   - Inject without errors - 1 test

**Integration Tests (V1 - AI SDK v1):** 6. `packages/memory/integration-tests/src/working-memory-processor.test.ts` (392 lines)

- **DUPLICATE** of V5 test #3 (same 5 tests, different AI SDK version)

#### Identified Issues:

- **Duplicate Tests**: V1 and V5 integration tests have identical test cases
- **Fragmented Coverage**: V5 tests split across 3 files unnecessarily
- **Redundant Setup**: Each file has its own mock/setup boilerplate

#### Consolidation Strategy:

**Step 1: Merge Unit Tests**

- **Keep**: `working-memory.test.ts` as the base
- **Merge in**: All tests from `working-memory-comprehensive.test.ts`
- **Result**: Single comprehensive unit test file (~900 lines)
- **Delete**: `working-memory-comprehensive.test.ts`

**Step 2: Merge V5 Integration Tests**

- **Keep**: `working-memory-processor.test.ts` as the base (most comprehensive)
- **Merge in**: Tests from `working-memory-processor-basic.test.ts` (2 tests)
- **Merge in**: Tests from `working-memory-injection.test.ts` (1 test)
- **Result**: Single V5 integration test file (~500 lines)
- **Delete**: `working-memory-processor-basic.test.ts`
- **Delete**: `working-memory-injection.test.ts`

**Step 3: Keep V1 Integration Test**

- **Keep**: `integration-tests/working-memory-processor.test.ts` (for v1 SDK compatibility)
- **No changes**: Needed to test with AI SDK v1

#### Final Test Structure:

```
packages/core/src/processors/processors/
  ✅ working-memory.test.ts (~1,300 lines) - All unit tests (CONSOLIDATED)

packages/memory/integration-tests-v5/src/
  ✅ working-memory-processor.test.ts (~500 lines) - All V5 integration tests (CONSOLIDATED)

packages/memory/integration-tests/src/
  ✅ working-memory-processor.test.ts (392 lines) - V1 integration tests
```

**Reduction**: 6 files → 3 files, ~600 lines saved by removing duplication ✅ COMPLETED

### 8. Future Enhancements

#### Advanced Context Selection

- Semantic search across working memory sections
- Multi-turn context tracking for follow-up questions
- Entity recognition for targeted memory retrieval
- Temporal relevance (prioritize recent vs historical memory)

#### Intelligent Extraction

- Learning from user corrections
- Custom extraction patterns per domain
- Relationship extraction between entities
- Conflict resolution for contradictory information

#### Performance Optimizations

- Batch processing for multiple messages
- Incremental memory updates
- Memory compression for large contexts
- Caching strategies for frequently accessed memory

#### Integration Features

- Integration with RAG for context-aware updates
- Support for external knowledge bases
- Cross-thread memory sharing (with permissions)
- Memory versioning and rollback

### 9. Required Infrastructure Additions

To fully support input processing, we would need:

1. **Memory Query Enhancements**:
   - Add method to query specific sections of working memory
   - Support for partial template matching
   - Relevance scoring for memory sections

2. **Context Injection Helpers**:
   - Utility to format working memory for message injection
   - Methods to prevent duplicate context injection
   - Tracking of injected context in message metadata

3. **Semantic Matching** (if vector store available):
   - Method to embed user queries
   - Semantic search within working memory content
   - Relevance scoring based on embeddings

4. **Message Augmentation**:
   - Support for adding system messages with context
   - Methods to prepend/append to user messages
   - Metadata tracking for processor-generated content

Example new Memory methods needed:

```typescript
interface Memory {
  // Query specific sections of working memory
  queryWorkingMemorySections(params: {
    threadId: string;
    resourceId?: string;
    query: string;
    topK?: number;
    threshold?: number;
  }): Promise<WorkingMemorySection[]>;

  // Check if content exists in working memory
  workingMemoryContains(params: { threadId: string; resourceId?: string; searchString: string }): Promise<boolean>;

  // Get relevance scores for memory sections
  scoreWorkingMemoryRelevance(params: {
    threadId: string;
    resourceId?: string;
    query: string;
    sections: string[];
  }): Promise<{ section: string; score: number }[]>;
}
```

## Implementation Checklist

### Core Implementation ✅ COMPLETED

- [x] Create `working-memory.ts` processor file (952 lines)
- [x] Implement both `processInput` and `processOutputResult` methods
- [x] Create extraction agent for output processing
- [x] Add storage integration for read/write operations
- [x] Create context selection agent (code present but commented out)

### Input Processing Features

- [x] Query working memory for current state
- [x] Support different injection strategies (system/user-prefix/context)
- [x] Implement max injection size limits (2000 chars default)
- [x] Handle empty or missing working memory gracefully
- [x] Extract from user messages BEFORE injection
- [ ] Implement relevance scoring (prepared but disabled)
- [ ] Add semantic search support when vector store available

### Output Processing Features

- [x] Extract from assistant messages
- [x] Extract from user messages (configurable)
- [x] Support markdown templates
- [x] Support JSON templates
- [x] Support Zod schema templates
- [x] Implement confidence scoring (0.3/0.5/0.7 by strategy)
- [x] Duplicate detection and prevention
- [ ] Use `__experimental_updateWorkingMemoryVNext` (not used currently)

### Quality & Testing

- [x] Add comprehensive error handling (non-blocking)
- [x] Prevent injection/extraction feedback loops (marker system)
- [x] Write unit tests (630 lines)
- [x] Write integration tests with real LLMs (900+ lines)
- [x] Test with various message formats
- [x] Test different templates (markdown, JSON, schema)
- [ ] Test with streaming outputs (processOutputStream not implemented)
- [ ] Consolidate duplicate test files

### Documentation

- [x] Update processor index exports
- [x] Add inline code documentation
- [x] Create usage examples in tests
- [x] Document configuration options
- [ ] Create public documentation
- [ ] Add troubleshooting guide

### Remaining Tasks

1. **Test Consolidation** (Priority: High)
   - Merge 6 test files into 2 (unit + integration)
   - Remove duplicate test cases
   - Improve test organization

2. **Performance Optimizations** (Priority: Medium)
   - Re-enable context selection agent
   - Add caching for working memory reads
   - Implement batch processing

3. **Feature Enhancements** (Priority: Low)
   - Implement `processOutputStream` for streaming
   - Add semantic search integration
   - Use `__experimental_updateWorkingMemoryVNext`

## Notes

### Challenges to Consider

1. **Avoiding infinite loops**:
   - Ensure the processor doesn't trigger on its own injected context
   - Track injection markers to avoid re-processing
   - Use message metadata to identify processor-generated content

2. **Performance**:
   - Cache working memory reads within a conversation turn
   - Batch LLM calls where possible
   - Use lighter models for context selection vs extraction

3. **Accuracy**:
   - Balance between capturing too much and missing important info
   - Different thresholds for injection vs extraction
   - Consider message history for context

4. **Privacy**:
   - Ensure sensitive information is handled appropriately
   - Allow filtering of PII before storage
   - Respect user preferences for data retention

5. **Template compatibility**:
   - Support various working memory template formats
   - Handle schema evolution gracefully
   - Validate against templates before updates

### Design Decisions

1. **Dual-mode processor**: Support both input and output processing in one class
2. **Two internal agents**: Separate agents for context selection and extraction
3. **Flexible configuration**: Allow enabling/disabling each processing mode
4. **Process user messages too**: Optionally extract from user inputs for completeness
5. **Non-blocking operations**: Warn on failure, don't abort message flow
6. **Smart injection**: Multiple strategies for how to add context to messages

## Implementation Differences from Plan

### Major Changes:

1. **Storage vs Memory**: Uses `storage: MastraStorage` directly instead of `memory: Memory`
2. **Automatic Context**: `threadId` and `resourceId` passed automatically by ProcessorRunner
3. **Always Active**: Both input and output processing always enabled (no toggle options)
4. **Extract-Before-Inject**: User message extraction happens BEFORE injection in same method
5. **Resource Scope Default**: Defaults to resource-scoped instead of thread-scoped

### What Was Not Implemented:

1. **Streaming Processing**: No `processOutputStream` implementation
2. **Selective Context**: Context selection agent commented out
3. **Semantic Search**: No vector store integration for relevance
4. **Memory Methods**: The proposed Memory class enhancements weren't added

### What Was Added Beyond Plan:

1. **Template Validation**: Prevents saving template as data
2. **Injection Markers**: System to prevent feedback loops
3. **Non-Blocking Design**: All failures are logged, not thrown
4. **ProcessorRunner Changes**: Enhanced to pass context to processors
