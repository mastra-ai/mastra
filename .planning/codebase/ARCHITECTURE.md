# Architecture

**Analysis Date:** 2026-01-23

## Pattern Overview

**Overall:** Layered plugin architecture with central orchestration hub

**Key Characteristics:**
- Central `Mastra` class as dependency injection container and configuration hub
- Agent-based primary AI interaction abstraction with message state management
- Pluggable storage backends with standardized domain interfaces (workflows, memory, scores, agents)
- Processor-based message transformation pipeline for input/output handling
- Tool system supporting dynamic composition from multiple sources (assigned tools, memory tools, toolsets, MCP servers)
- Request-scoped context propagation for dynamic configuration and auth

## Layers

**Orchestration Layer:**
- Purpose: Central configuration and dependency management
- Location: `packages/core/src/mastra/index.ts`, `packages/core/src/mastra/`
- Contains: `Mastra` class with agent/workflow/storage registration, hook system, logging configuration
- Depends on: All domain components, storage, loggers, observability
- Used by: Application entry point; consumed by all agents and workflows

**Agent Layer:**
- Purpose: AI interaction abstraction with tool-loop agentic pattern
- Location: `packages/core/src/agent/`
- Contains: `Agent` class, `MessageList` (message state management), message saving queue, TripWire (abort/retry mechanism)
- Depends on: LLM models, tools, processors, memory, storage, message handling
- Used by: Direct client calls, workflows as steps, tool-loop agent network

**Workflow Engine:**
- Purpose: Step-based execution with type-safe composition
- Location: `packages/core/src/workflows/`
- Contains: `Workflow` class, `Step` creation, execution engine (default and custom), event streaming, suspend/resume
- Depends on: Tools, agents, processors, agents as steps
- Used by: Application orchestration, agent step definitions, processor workflows

**Tool System:**
- Purpose: Unified tool interface and composition
- Location: `packages/core/src/tools/`
- Contains: `Tool` class, tool validation, tool execution context
- Depends on: Storage, request context, validation schemas
- Used by: Agents (dynamic composition), workflows, LLM calls

**Message Processing Pipeline:**
- Purpose: Transform messages/chunks at agent execution pipeline stages
- Location: `packages/core/src/processors/`
- Contains: `Processor` interface with stage-specific methods (processInput, processInputStep, processOutputStream, processOutputStep, processOutputResult), processor runner, memory processors
- Depends on: MessageList, storage, abort mechanism (TripWire)
- Used by: Agent execution flow at each pipeline stage

**Storage Layer:**
- Purpose: Unified data persistence with pluggable backends
- Location: `packages/core/src/storage/`
- Contains: `MastraCompositeStore` base class, domain interfaces (WorkflowsStorage, MemoryStorage, ScoresStorage, AgentsStorage, ObservabilityStorage)
- Depends on: Type definitions for each domain
- Used by: Mastra class, agents, workflows, memory, run tracking

**Memory System:**
- Purpose: Conversation persistence and semantic recall
- Location: `packages/core/src/memory/`
- Contains: `MastraMemory` class, memory processors (MessageHistory, WorkingMemory, SemanticRecall)
- Depends on: Storage (memory domain), vector stores, LLM for embeddings
- Used by: Agents for conversation history, semantic search

**Vector Store Layer:**
- Purpose: Semantic search and embedding storage
- Location: `packages/core/src/vector/`
- Contains: `MastraVector` interface, filter system for semantic queries
- Depends on: LLM for embeddings, storage
- Used by: Memory system for semantic recall, RAG operations

**LLM Integration:**
- Purpose: Model gateway and provider abstraction
- Location: `packages/core/src/llm/`
- Contains: Provider registry, model router, gateway support (Netlify, Azure OpenAI, models.dev)
- Depends on: AI SDK (v4 and v5 integration), schema compatibility layer
- Used by: Agents, memory, vector stores

**Request Context:**
- Purpose: Request-scoped state and security boundaries
- Location: `packages/core/src/request-context/`
- Contains: `RequestContext` generic container with set/get/has/delete operations
- Constants: `MASTRA_RESOURCE_ID_KEY`, `MASTRA_THREAD_ID_KEY` for security
- Used by: Server adapters, agents, workflows for threading/auth

**Server Integration:**
- Purpose: HTTP framework adapters
- Location: `packages/core/src/server/`, `server-adapters/`
- Contains: Base server interface, middleware support, context management
- Server adapters: Express, Hono, Fastify, Koa
- Used by: HTTP applications using Mastra

## Data Flow

**Agent Execution Flow:**

1. Client calls `agent.generate()` or `agent.stream()` with messages
2. Request context (auth, threadId, resourceId) injected via middleware
3. Processors run `processInput()` to transform input messages
4. Messages sent to LLM with available tools
5. LLM returns tool calls (if any) or text
6. Processors run `processOutputStep()` after each LLM response
7. Tools executed in agentic loop (network loop in `packages/core/src/loop/`)
8. MessageList appends new messages, calls save queue for async persistence
9. Processors run `processOutputStream()` for chunk filtering in streams
10. Loop repeats until finish_reason = "stop" (no more tool calls)
11. Processors run `processOutputResult()` on final result
12. Result returned to client

**Message State Management:**

- `MessageList` wraps message array with metadata tracking
- Tracks message sources (user, assistant, tool, system)
- Defers persistence to `SaveQueueManager` for non-blocking saves
- Supports message search by role/source/tool
- Integrates with memory processors for embedding/storage of new messages

**Storage Interaction:**

- Workflows persist run state (initial state, steps, final state) to `workflows` domain
- Memory persists messages/threads to `memory` domain
- Scores persists evaluation results to `scores` domain
- Agents store agent metadata to `agents` domain
- Cross-domain access via `MastraCompositeStore.stores` property

**State Management:**

- Agent state: In-memory during execution, persisted to storage after completion
- Memory state: Stored in persistent storage, loaded on agent initialization
- Workflow state: Persisted between steps for suspend/resume capability
- Request context: Request-scoped, passed through execution chain

## Key Abstractions

**Mastra Class:**
- Purpose: Central hub for configuration, dependency registration, and runtime access
- Location: `packages/core/src/mastra/index.ts`
- Pattern: Service locator + DI container
- Registered items: agents, workflows, tools, vectors, memory, processors, scorers, servers, gateways

**Agent Class:**
- Purpose: Autonomous AI system with tool execution and state management
- Location: `packages/core/src/agent/agent.ts`
- Pattern: Command executor with pipeline stages
- Execution methods: `generate()` (single response), `stream()` (streaming response), `network()` (multi-agent)

**Workflow Class:**
- Purpose: Type-safe, composable task orchestration
- Location: `packages/core/src/workflows/workflow.ts`
- Pattern: Graph-based step execution with type propagation
- Supports: Branching, looping, agent integration, error handling

**Step Creation:**
- Purpose: Wrap tasks (agents, tools, custom functions) as workflow steps
- Location: `packages/core/src/workflows/step.ts`
- Variants: Agent steps, tool steps, custom steps with I/O schemas

**Processor Interface:**
- Purpose: Transformation hook at specific pipeline stages
- Location: `packages/core/src/processors/index.ts`
- Stages: processInput, processInputStep, processOutputStream, processOutputStep, processOutputResult
- Pattern: Chain of responsibility with abort/retry capability via TripWire

**Storage Domains:**
- Purpose: Separate concerns by data type with pluggable implementations
- Types: WorkflowsStorage, MemoryStorage, ScoresStorage, AgentsStorage, ObservabilityStorage
- Pattern: Interface-based contracts; implementations in `stores/` (pg, libsql, mongodb, chroma, etc.)

**Message List:**
- Purpose: Message state container with source tracking and deferred persistence
- Location: `packages/core/src/agent/message-list/`
- Methods: append, search by role/source, get new messages since last save
- Integration: Saves asynchronously via SaveQueueManager

**Vector Store:**
- Purpose: Semantic search abstraction
- Location: `packages/core/src/vector/`
- Methods: Create embeddings, query with filters, delete
- Implementations: Chroma, Pinecone, Qdrant, Lance, Cloudflare, OpenSearch, etc. (in `stores/`)

## Entry Points

**Mastra Application:**
- Location: Application root (user code)
- Triggers: Application startup
- Responsibilities: Create Mastra instance, register agents/workflows/storage, expose via server

**Agent Execution:**
- Location: `packages/core/src/agent/agent.ts` (methods: generate, stream, network)
- Triggers: Client request to agent endpoint
- Responsibilities: Initialize context, run message pipeline, save state, return result

**Workflow Execution:**
- Location: `packages/core/src/workflows/workflow.ts` (method: execute)
- Triggers: Manual call or agent step execution
- Responsibilities: Execute steps in order, handle branching, persist run state

**Server Middleware:**
- Location: `server-adapters/` (Express, Hono, Fastify, Koa)
- Triggers: HTTP request
- Responsibilities: Extract auth context, set RequestContext, inject into Mastra

**LLM Call:**
- Location: `packages/core/src/llm/` (generateText, streamText, etc.)
- Triggers: Agent/workflow needs LLM response
- Responsibilities: Resolve model, run processors, call LLM, handle streaming

## Error Handling

**Strategy:** Typed error domain hierarchy with categorization

**Error Structure:**
- Location: `packages/core/src/error/`
- Properties: id (unique), domain (MASTRA, INTEGRATION, LLM, STORAGE, etc.), category (USER, SYSTEM, INTEGRATION), text, details
- Error IDs: Uppercase format: `MASTRA_AGENT_GENERATION_FAILED`, `STORAGE_SAVE_ERROR`, etc.

**Patterns:**
- User errors (bad input): `ErrorCategory.USER` with HTTP 400
- System errors (internal failures): `ErrorCategory.SYSTEM` with HTTP 500
- Integration errors (external API): `ErrorCategory.INTEGRATION` with specific status
- TripWire mechanism for processor abort/retry: `context.abort(reason, { retry: true })`

**Recovery:**
- Processor retry on TripWire abort with `retry: true` flag
- Storage fallback to default domain if specific domain unavailable
- Tool execution failures bubble to agent for retry or completion

## Cross-Cutting Concerns

**Logging:**
- Framework: Configurable logger (ConsoleLogger default, Pino, custom)
- Pattern: Registered via Mastra config, injected via `__setLogger()` on components
- Levels: DEBUG, INFO, WARN, ERROR configured by environment
- Location: `packages/core/src/logger/`

**Validation:**
- Framework: Zod schemas for inputs/outputs at tool, step, workflow boundaries
- Pattern: Validation errors caught at execution time with detailed messages
- Schema compatibility: `@mastra/schema-compat` for AI SDK v4/v5 interop
- Location: `packages/core/src/tools/validation.ts`, agent schema handling

**Authentication:**
- Pattern: RequestContext middleware hook for setting `MASTRA_RESOURCE_ID_KEY` and `MASTRA_THREAD_ID_KEY`
- Security: Server-set context values take precedence over client-provided
- Scope: Resource isolation via resourceId, thread isolation via threadId
- Location: Server adapters integrate with Mastra RequestContext

**Observability:**
- Framework: Tracing and span export via `@mastra/observability` (optional)
- Pattern: Request-scoped tracing context passed through execution
- Entities: Agents, workflows, LLM calls tracked as spans
- Optional exporters: Datadog, HoneyComb, custom
- Location: `packages/core/src/observability/`

**Streaming:**
- Format: ChunkType union supporting text, tool calls, tool results, deltas
- Pattern: Processors can filter/transform chunks in `processOutputStream()`
- Serialization: WorkflowRunOutput for JSON serialization of events
- Location: `packages/core/src/stream/`

**Caching:**
- Purpose: Server-side cache for tool results or LLM responses
- Implementation: InMemoryServerCache (default), pluggable via Mastra config
- Location: `packages/core/src/cache/`

---

*Architecture analysis: 2026-01-23*
