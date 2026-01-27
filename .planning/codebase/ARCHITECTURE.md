# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Modular AI framework with central orchestration hub and pluggable component system using dependency injection.

**Key Characteristics:**
- Central Mastra class serves as configuration and dependency container for all components
- Pluggable architecture for storage, memory, vectors, and processors
- Component registration via constructor configuration
- Event-driven communication through PubSub system
- Request-scoped context for dynamic runtime configuration
- Layered execution with agents, workflows, and processors

## Layers

**Orchestration Layer (Mastra):**
- Purpose: Central configuration hub and dependency injection container
- Location: `packages/core/src/mastra/index.ts`
- Contains: Mastra class that registers and manages all framework components
- Depends on: All other framework components (optional)
- Used by: Application entry point; accessed by agents, workflows, and processors

**Agent Layer:**
- Purpose: Primary AI interaction abstraction with LLM integration, tool execution, and conversation management
- Location: `packages/core/src/agent/`
- Contains: Agent class, message handling, tool orchestration, streaming
- Depends on: LLM models, tools, memory, storage, message list, processors
- Used by: Applications for direct LLM interaction; wrapped as workflow steps

**Workflow Layer:**
- Purpose: Step-based execution engine for sequential and conditional processing with suspend/resume
- Location: `packages/core/src/workflows/`
- Contains: Workflow class, step definitions, execution engine, state management
- Depends on: Steps (agents, tools, processors), storage for state, observability
- Used by: Complex task orchestration; agent network coordination

**Tool System:**
- Purpose: Dynamic tool composition supporting multiple sources (assigned, memory, toolsets, MCP)
- Location: `packages/core/src/tools/`
- Contains: Tool base class, validation, toolsets, MCP integration
- Depends on: Schema validation (Zod), action abstraction
- Used by: Agents and workflows for LLM function calling

**Memory System:**
- Purpose: Thread-based conversation persistence with semantic recall and working memory
- Location: `packages/core/src/memory/`
- Contains: MastraMemory class, message history, semantic recall, working memory processors
- Depends on: Storage, vector stores (for semantic search), processors
- Used by: Agents for conversation context management

**Processor System:**
- Purpose: Pluggable middleware for transforming messages before/after LLM calls
- Location: `packages/core/src/processors/`
- Contains: Input processors, output processors, processor runners, structured output
- Depends on: Message types, validation schemas
- Used by: Agents to modify LLM inputs/outputs; workflows for data transformation

**Storage Layer:**
- Purpose: Pluggable backend abstraction for persisting agents, workflows, memory, observations
- Location: `packages/core/src/storage/`
- Contains: Base storage interface, domain-specific storage (memory, workflows, observability, scores)
- Depends on: Storage adapter implementations (separate packages)
- Used by: Memory system, workflow state persistence, observability data collection

**LLM Model Layer:**
- Purpose: Language model abstraction supporting multiple providers via routing
- Location: `packages/core/src/llm/`
- Contains: Model routers, AI SDK adapters (v4, v5), gateway configuration
- Depends on: AI SDK, provider SDKs, schema compatibility layer
- Used by: Agents for text generation, object generation, streaming

**Stream Layer:**
- Purpose: Event-based output streaming with chunk typing and format conversion
- Location: `packages/core/src/stream/`
- Contains: Output formatting, chunk types, streaming utilities, schema transformation
- Depends on: Message types, schema validation
- Used by: Agents and workflows to deliver real-time output to clients

**Observability Layer:**
- Purpose: Tracing context propagation and span tracking for debugging
- Location: `packages/core/src/observability/`
- Contains: Span types, tracing context, entity tracking
- Depends on: Storage for span persistence
- Used by: All major components for telemetry

**Vector Layer:**
- Purpose: Semantic search through vector stores
- Location: `packages/core/src/vector/`
- Contains: Vector store abstraction, filtering
- Depends on: Vector store adapter implementations
- Used by: Memory system for semantic recall

**Request Context Layer:**
- Purpose: Request-scoped metadata propagation for runtime configuration
- Location: `packages/core/src/request-context/`
- Contains: RequestContext class, resource ID and thread ID constants
- Depends on: None
- Used by: Security middleware, agents, workflows for multi-tenant support

## Data Flow

**Agent Execution (Text Generation):**

1. User calls `agent.generate(input, options)` with optional threadId/resourceId
2. Agent resolves LLM model and tools
3. MessageList loads conversation history from memory
4. Input processors transform messages (via ProcessorRunner)
5. LLM generates response (single turn) or Agent loop runs (multi-turn with tools)
6. Output processors transform response
7. Memory saves messages (via SaveQueueManager)
8. Response returned to caller with metadata

**Workflow Execution:**

1. User calls `workflow.stream(input)` with workflow context
2. Execution engine initializes step state
3. For each step:
   - Execute step function (agent, tool, processor, or custom function)
   - Collect step output in StepResult
   - Run next step based on flow conditions
   - Handle errors via error handlers or retry
4. Workflow completes when terminal step reached or error occurs
5. Output streamed to caller via ReadableStream

**Tool Execution in Agent Loop:**

1. LLM returns tool calls
2. Agent validates tool arguments against schema
3. Tool execute function invoked with IExecutionContext
4. Tool result returned to LLM
5. LLM continues reasoning or returns final response

**Memory Recall Process:**

1. Semantic recall processor enabled in memory config
2. Current user message embedded via vector model
3. Vector store searched for similar previous messages
4. Top similar messages injected into message history
5. Agent processes enriched message list

**State Management:**

- Agent state: RequestContext stores resourceId and threadId for multi-tenancy
- Workflow state: Persisted in storage after each step for resume capability
- Message state: MessageList manages source tracking and deduplication
- Processor state: ProcessorRunner tracks retry count and processor state

## Key Abstractions

**MastraBase:**
- Purpose: Base class for all framework components with logging support
- Examples: `packages/core/src/base.ts`
- Pattern: All major components (Agent, Mastra, Workflow) extend MastraBase
- Provides: Component registration, logger injection, name management

**IAction Interface:**
- Purpose: Unified abstraction for any executable component (agents, tools, processors)
- Examples: Agent, Tool, Processor all implement IAction variants
- Pattern: Type-safe execution context with input/output schemas

**MastraCompositeStore:**
- Purpose: Aggregated storage interface combining multiple domain-specific stores
- Examples: `packages/core/src/storage/index.ts`
- Pattern: Storage domains (memory, workflows, observability) accessed through single interface

**StorageDomain:**
- Purpose: Base interface for domain-specific storage implementations
- Examples: `packages/core/src/storage/domains/base.ts`
- Pattern: Each domain (memory messages, workflow runs, observation spans) extends StorageDomain

**MessageList:**
- Purpose: Unified message abstraction handling multiple formats (v1, v4, v5)
- Examples: `packages/core/src/agent/message-list/index.ts`
- Pattern: Adapters convert between AI SDK versions; state manager tracks sources and deduplication

**Core Tool:**
- Purpose: Standardized tool interface compatible with AI SDK
- Examples: `packages/core/src/tools/types.ts`
- Pattern: Created via createTool factory; supports validation, execution, streaming

**Processor:**
- Purpose: Pluggable middleware in agent/workflow execution
- Examples: `packages/core/src/processors/index.ts`
- Pattern: Input/output processors with abort/retry capability

**Workflow Step:**
- Purpose: Executable unit within workflow
- Examples: `packages/core/src/workflows/step.ts`
- Pattern: Steps are agents, tools, processors, or custom functions; connected via flow

## Entry Points

**CLI Entry:**
- Location: `packages/cli/src/index.ts`
- Triggers: Command-line invocation
- Responsibilities: Project scaffolding, playground launching, deployment

**Playground Entry:**
- Location: `packages/playground/src/index.ts`
- Triggers: Browser access to development UI
- Responsibilities: Interactive agent/workflow testing, chat interface

**Server Entry:**
- Location: `packages/server/src/index.ts`
- Triggers: HTTP request to endpoint
- Responsibilities: Agent execution via REST API, memory persistence, webhooks

**Direct SDK Usage:**
- Location: Application code importing from `@mastra/core`
- Entry: `packages/core/src/index.ts`
- Triggers: Agent instantiation and method calls
- Responsibilities: LLM interaction, tool execution, conversation management

**Workflow Entry:**
- Location: User creates workflow via createWorkflow()
- Triggers: Workflow instantiation and execution
- Responsibilities: Multi-step task orchestration with state persistence

## Error Handling

**Strategy:** Hierarchical error handling with domain-specific error categories

**Patterns:**

**MastraError Class:**
- Structured errors with domain, category (USER/SYSTEM/THIRD_PARTY), and unique ID
- Serializable for logging and client transmission
- Examples: ErrorDomain.AGENT, ErrorDomain.TOOL, ErrorDomain.MASTRA_WORKFLOW

**Component-Level Errors:**
- Agents catch LLM errors and tool execution errors
- TripWire mechanism aborts execution with retry capability
- Processors abort with custom reason strings

**User Error Detection:**
- Schema validation errors classified as USER errors
- Configuration errors classified as USER errors
- LLM/API failures classified as THIRD_PARTY errors

**Error Propagation:**
- Errors bubble up through workflow execution
- Observability layer captures error spans for tracing
- Error handlers in workflows can catch and retry

## Cross-Cutting Concerns

**Logging:**
- RegisteredLogger component tracking (AGENT, TOOL, LLM, etc.)
- Logger injected via MastraBase.__setLogger()
- Default ConsoleLogger; custom logger via Mastra config

**Validation:**
- Zod for schema validation throughout
- Input/output validation at action boundaries
- JSONSchema for LLM tool specification

**Authentication:**
- RequestContext stores resourceId from auth middleware
- MASTRA_RESOURCE_ID_KEY reserved for user identity
- MASTRA_THREAD_ID_KEY reserved for conversation threading

**Observability:**
- Distributed tracing via EntityType (AGENT, TOOL, WORKFLOW)
- SpanType defines execution phases (START, END, ERROR)
- InternalSpans namespace for framework spans
- TracingContext propagated through execution

**Dependency Injection:**
- Mastra instance holds references to all components
- RequestContext provides runtime configuration
- Components access dependencies via passed parameters

**Multi-Tenancy:**
- ResourceId/ThreadId in RequestContext prevent cross-tenant data access
- Storage domain queries filtered by these context values
- Agent execution respects context-bound memory scoping

---

*Architecture analysis: 2026-01-27*
