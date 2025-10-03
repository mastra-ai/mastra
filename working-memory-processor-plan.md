# Working Memory Output Processor Plan

## Overview

Create a bidirectional processor that:

1. **Input Processing**: Enriches user messages with relevant context from working memory
2. **Output Processing**: Captures and stores important information from agent responses into working memory

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

```typescript
interface WorkingMemoryProcessorOptions {
  /**
   * Memory instance to use for storing working memory updates.
   * This must be an instance of Memory class from @mastra/memory package
   * that has been configured with storage and optionally vector/embedder.
   */
  memory: Memory;

  /**
   * Language model used by the internal extraction agent to analyze content
   * and determine what information should be stored in working memory.
   * Should be a capable model (e.g., GPT-4, Claude) for best results.
   */
  model: MastraLanguageModel;

  /**
   * Thread ID for the current conversation thread.
   * Required for thread-scoped working memory updates.
   * Will be passed to memory.updateWorkingMemory() calls.
   */
  threadId: string;

  /**
   * Resource ID for resource-scoped working memory.
   * Optional - only needed when using resource-scoped memory
   * (configured via memoryConfig.workingMemory.scope: 'resource').
   */
  resourceId?: string;

  /**
   * Optional memory configuration to override the Memory instance's defaults.
   * Allows customizing working memory behavior per processor instance:
   * - workingMemory.enabled: Whether working memory is active
   * - workingMemory.template: Template for structured memory
   * - workingMemory.scope: 'thread' or 'resource'
   * - workingMemory.schema: JSON schema for structured output
   */
  memoryConfig?: MemoryConfig;

  // ============= Input Processing Options =============

  /**
   * Enable input processing to inject working memory context.
   * When true, analyzes user messages and adds relevant context.
   * Default: true
   */
  enableInputProcessing?: boolean;

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
   * Enable output processing to extract and store information.
   * When true, analyzes responses and updates working memory.
   * Default: true
   */
  enableOutputProcessing?: boolean;

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

  /**
   * Whether to process streaming outputs chunk by chunk.
   * When true, analyzes partial responses as they stream.
   * When false, only processes complete responses after streaming.
   * Default: false (process complete messages only).
   *
   * Note: Streaming analysis may miss context and increase LLM calls.
   */
  processStreaming?: boolean;
}
```

### 5. Implementation Steps

#### Step 1: Create the processor class structure

- Implement the `Processor` interface with both `processInput` and `processOutputResult`
- Set up two internal agents: context selection and extraction
- Configure options handling for both input and output processing

#### Step 2: Implement input processing logic

- Analyze user messages to understand query intent
- Create context selection agent to identify relevant memory sections
- Query working memory for current state
- Select relevant portions based on semantic matching or keywords
- Inject context into message stream appropriately

#### Step 3: Implement output processing logic

- Analyze both user and assistant messages for important information
- Use the extraction agent to identify what should be remembered
- Extract structured information based on working memory template
- Handle information from user messages if enabled

#### Step 4: Integrate with Memory

- Get current working memory state for reading
- Use semantic search if available for context matching
- Determine what's new vs. what's already stored
- Update working memory with new information
- Handle both append and replace strategies
- Use `__experimental_updateWorkingMemoryVNext` for smart deduplication

#### Step 5: Handle edge cases

- Empty or trivial messages
- Duplicate information
- Conflicting updates
- Template validation
- Error recovery
- Prevent feedback loops (processor seeing its own injections)

### 6. Example Usage

```typescript
import { WorkingMemoryProcessor } from '@mastra/core/processors';
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core';

const memory = new Memory({
  storage: myStorage,
  vector: myVectorStore, // Optional: for semantic context matching
  embedder: myEmbedder, // Optional: required if using vector
  options: {
    workingMemory: {
      enabled: true,
      template: `
# User Information
- **Name**: 
- **Preferences**: 
- **Goals**: 
- **Recent Topics**: 
      `,
      scope: 'thread',
    },
  },
});

// Full-featured processor with both input and output processing
const processor = new WorkingMemoryProcessor({
  memory,
  model: myModel,
  threadId: 'thread-123',

  // Input processing options
  enableInputProcessing: true,
  injectionStrategy: 'smart',
  maxInjectionSize: 2000,
  injectionThreshold: 0.3,

  // Output processing options
  enableOutputProcessing: true,
  extractionStrategy: 'balanced',
  extractFromUserMessages: true,
  confidenceThreshold: 0.7,
});

// Use in agent configuration
const agent = new Agent({
  name: 'my-agent',
  model: myModel,
  memory, // Agent also needs memory for conversation history
  inputProcessors: [processor], // For context injection
  outputProcessors: [processor], // For information extraction
});

// Alternative: Input-only processor for context injection
const inputOnlyProcessor = new WorkingMemoryProcessor({
  memory,
  model: myModel,
  threadId: 'thread-456',
  enableInputProcessing: true,
  enableOutputProcessing: false, // Disable extraction
  injectionStrategy: 'system',
});

// Alternative: Output-only processor for extraction
const outputOnlyProcessor = new WorkingMemoryProcessor({
  memory,
  model: myModel,
  threadId: 'thread-789',
  enableInputProcessing: false, // Disable injection
  enableOutputProcessing: true,
  extractionStrategy: 'aggressive',
});
```

### 7. Testing Strategy

- Unit tests for extraction logic
- Integration tests with Memory
- Test with various message formats
- Test with different working memory templates
- Performance testing for large conversations

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

### Core Implementation

- [ ] Create `working-memory.ts` processor file
- [ ] Implement both `processInput` and `processOutputResult` methods
- [ ] Create context selection agent for input processing
- [ ] Create extraction agent for output processing
- [ ] Add Memory integration for both read and write operations

### Input Processing Features

- [ ] Query working memory for current state
- [ ] Implement relevance scoring for context selection
- [ ] Support different injection strategies (system/user-prefix/context)
- [ ] Add semantic search support when vector store is available
- [ ] Implement max injection size limits
- [ ] Handle empty or missing working memory gracefully

### Output Processing Features

- [ ] Extract from assistant messages
- [ ] Extract from user messages (optional)
- [ ] Support markdown templates
- [ ] Support JSON templates
- [ ] Implement confidence scoring
- [ ] Use `__experimental_updateWorkingMemoryVNext` for smart updates

### Quality & Testing

- [ ] Add comprehensive error handling
- [ ] Prevent injection/extraction feedback loops
- [ ] Write unit tests for both input and output processing
- [ ] Write integration tests with Memory
- [ ] Test with various message formats
- [ ] Test with streaming outputs
- [ ] Performance testing for large conversations

### Documentation

- [ ] Update processor index exports
- [ ] Add inline code documentation
- [ ] Create usage examples
- [ ] Document configuration options
- [ ] Add troubleshooting guide

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

## API Verification Notes

Based on code review:

1. **Agent Configuration**:
   - Use `outputProcessors` array property (not `processors: { post: [] }`)
   - Agent accepts `DynamicArgument<OutputProcessor[]>` for outputProcessors
2. **Memory API**:
   - `Memory.updateWorkingMemory()` - Direct update method
   - `Memory.__experimental_updateWorkingMemoryVNext()` - Smart update with deduplication
   - `Memory.getWorkingMemory()` - Read current working memory
   - `Memory.getWorkingMemoryTemplate()` - Get template structure
3. **Processor Interface**:
   - Must implement `OutputProcessor` which requires either:
     - `processOutputStream()` for streaming
     - `processOutputResult()` for complete messages
   - Both methods receive `messages: MastraMessageV2[]`
4. **Model Configuration**:
   - Agent model can be `MastraModelConfig`, function returning config, or array of models with fallback
   - Processors should use `MastraLanguageModel` type for models
