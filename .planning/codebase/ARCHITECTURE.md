# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Central orchestration hub with dependency injection and plugin architecture

**Key Characteristics:**
- Mastra class serves as the central configuration and registry hub
- Pluggable components (agents, workflows, storage, vectors, loggers) are registered at init-time
- Declarative, type-safe composition with TypeScript generics throughout
- Request-scoped context propagation for dynamic runtime configuration
- Event-driven architecture with PubSub for internal communication

## Layers

**Core Framework Layer (`packages/core/src/`):**
- Purpose: Central orchestration, base abstractions, and common utilities
- Location: `packages/core/src/`
- Contains: Mastra class, Agent, Workflow, Tools, Memory, Storage, Processors
- Depends on: LLM models, AI SDK integrations
- Used by: All higher-level packages (server, CLI, deployers, client SDKs)

**Storage & Persistence Layer:**
- Purpose: Abstract data persistence with pluggable backends
- Location: `packages/core/src/storage/` (interfaces) and `stores/*` (implementations)
- Contains: Composite store pattern, domain-specific storage (agents, workflows, memory, scores)
- Depends on: Database/backend implementations in `stores/`
- Used by: Agents (for memory), Workflows (for run state), Memory system

**Agent Layer:**
- Purpose: Autonomous execution with tool invocation and message management
- Location: `packages/core/src/agent/`
- Contains: Agent class, message list management, message-to-prompt conversion, network execution
- Depends on: LLM models, Tools, Storage, Memory, Processors
- Used by: Workflows, Server handlers, Client SDKs

**Workflow Layer:**
- Purpose: Step-based execution engine with state management and suspend/resume
- Location: `packages/core/src/workflows/`
- Contains: Workflow class, step definitions, execution engines, event processors
- Depends on: Agents, Processors, Storage (for run state), LLM models
- Used by: Server, CLI, Agents (as substeps)

**Tools System:**
- Purpose: Dynamic tool composition supporting multiple sources
- Location: `packages/core/src/tools/`
- Contains: Tool definitions, validation, tool builders, Vercel AI SDK compatibility
- Depends on: Zod schemas, JSON schema conversion
- Used by: Agents, Processors, Integrations

**Memory System:**
- Purpose: Thread-based conversation persistence with semantic recall
- Location: `packages/core/src/memory/`
- Contains: Memory class, working memory, message embedding/recall
- Depends on: Storage, Vector stores, Agents
- Used by: Agents, Processors

**LLM & Model Router:**
- Purpose: Unified interface to multiple language models with gateway abstraction
- Location: `packages/core/src/llm/`
- Contains: Model router, provider gateways, schema compatibility layer
- Depends on: AI SDK v4/v5, provider integrations
- Used by: Agents, Workflows, Processors

**Server & Middleware Layer:**
- Purpose: HTTP endpoint abstraction and middleware support
- Location: `packages/core/src/server/` and `server-adapters/`
- Contains: Server base class, auth handlers, middleware composition
- Depends on: Core framework
- Used by: Server package, deployer packages

**Processors:**
- Purpose: Hooks for transforming inputs/outputs in agents and workflows
- Location: `packages/core/src/processors/`
- Contains: Input/output processors, workflow processors, processor runner
- Depends on: LLM models, Message lists, Workflows
- Used by: Agents, Workflows

## Data Flow

**Agent Execution Flow:**

1. User calls `agent.generate()` or `agent.stream()`
2. Message list normalizes/converts incoming messages
3. Request context is established (thread ID, resource ID, tracing)
4. Input processors run, transforming system messages and inputs
5. Message list combines memory, static messages, and processor outputs
6. LLM is invoked through model router
7. Tool calls are parsed and executed sequentially
8. Tool results are processed and fed back to LLM
9. Output processors transform final response
10. Result is saved to storage (if configured) via SaveQueueManager
11. Response is returned/streamed to caller

**Workflow Execution Flow:**

1. User calls `workflow.run()` or `workflow.stream()`
2. Execution engine (DefaultExecutionEngine) processes step graph
3. For each step:
   - Inputs are validated and mapped
   - Step executes (Agent, Workflow, Tool, or custom function)
   - Outputs are captured and stored
   - Conditional branches/loops check result
4. Workflow state is persisted to storage after each step (if configured)
5. Suspended workflows can be resumed with time-travel context
6. Final output is returned with run metadata

**Tool Execution in Agent:**

1. Agent receives tool call from LLM
2. Tool is resolved from agent's unified tools list (assigned + memory + MCP + integrations)
3. Tool is executed with provided parameters
4. Result is captured and formatted
5. If tool has streaming response, chunks are collected
6. Result is sent back to LLM in next message

**State Management:**

- **Agent State:** Conversation history stored in MessageList, persisted to storage threads
- **Workflow State:** Step outputs and execution path stored in WorkflowRun, persisted to storage
- **Memory State:** Embeddings and recall results cached in memory system
- **Request Context:** Request-scoped context (thread ID, resource ID, tracing) propagated through call stack via RequestContext

## Key Abstractions

**Mastra Class (`packages/core/src/mastra/index.ts`):**
- Purpose: Central registry and orchestrator for all application components
- Registers agents, workflows, storage, vectors, loggers, MCP servers, processors, memory, tools
- Manages dependency injection and component initialization
- Provides access to server configuration and run methods

**Agent (`packages/core/src/agent/agent.ts`):**
- Purpose: Autonomous entity that can invoke tools and converse with LLM
- Encapsulates model configuration, instructions, tools, memory, processors, voice settings
- Provides multiple execution methods: `generate()`, `stream()`, `generateText()`, `streamText()`, `generateObject()`, `streamObject()`
- Manages message list, execution options, tool validation
- Integrates with AI SDK models, observability, and storage

**Workflow (`packages/core/src/workflows/workflow.ts`):**
- Purpose: Composable sequence of steps with conditional logic
- Defines step graph with branching and looping
- Supports agent steps, nested workflows, tool steps, processor steps
- Manages execution state and persistence
- Provides resume/time-travel capabilities for suspended executions

**MessageList (`packages/core/src/agent/message-list/message-list.ts`):**
- Purpose: Unified interface for message management across formats
- Adapters convert between different message formats (Vercel, OpenAI, Google, etc.)
- Manages memory integration (embedding and recall)
- Handles prompt construction and message merging
- Supports message state (source tracking, content types)

**Tool (`packages/core/src/tools/tool.ts` and `tool-builder/builder.ts`):**
- Purpose: Reusable functions with schema validation and execution context
- Supports Mastra tools, Vercel AI SDK tools, provider-defined tools
- Builders validate schemas against Zod and JSON Schema standards
- Execution context provides access to LLM, storage, observability

**Processor (`packages/core/src/processors/`):**
- Purpose: Middleware for transforming agent/workflow inputs and outputs
- Input processors can modify system messages and inputs
- Output processors can transform LLM responses
- Can be assigned to specific agents or applied globally
- Supports retry triggering via TripWire

**Storage Interfaces (`packages/core/src/storage/types.ts`):**
- Purpose: Abstraction for data persistence across multiple backends
- Composite store pattern: agents, workflows, memory, observability, scores domains
- Each domain has standardized CRUD operations
- Implementations in `stores/` support 20+ backends (Postgres, MongoDB, DynamoDB, etc.)

**Memory (`packages/core/src/memory/memory.ts`):**
- Purpose: Thread-scoped conversation persistence with semantic search
- Stores messages and embeddings in vector store
- Supports working memory (recent context) and semantic recall
- Integrates with agent message list for automatic recall
- Types: thread memory, working memory, tool calling context

**Vector Store (`packages/core/src/vector/`):**
- Purpose: Semantic search and similarity-based retrieval
- Pluggable backends (Pinecone, Chroma, Qdrant, etc.)
- Used by memory system for embedding and recall
- Used by RAG systems for document retrieval

## Entry Points

**Main Library Entry (`packages/core/src/index.ts`):**
- Location: `packages/core/src/index.ts`
- Triggers: Import by applications wanting to use Mastra
- Responsibilities: Exports Mastra class and Config interface for type-safe setup

**Agent Execution Entry Points:**
- `agent.generate(input, options)` - Single response generation
- `agent.stream(input, options)` - Streaming response
- `agent.generateText/generateObject` - Typed generation methods
- Location: `packages/core/src/agent/agent.ts`
- Triggers: User code calling agent methods
- Responsibilities: Execute message processing, tool calls, LLM invocation, output formatting

**Workflow Execution Entry Points:**
- `workflow.run(input, options)` - Single execution
- `workflow.stream(input, options)` - Streaming execution
- Location: `packages/core/src/workflows/workflow.ts`
- Triggers: User code or server handlers calling workflow
- Responsibilities: Execute step graph, manage state, handle branching/looping

**Server Entry Points (in `server-adapters/`):**
- Express: `createExpressAdapter(mastra, options)`
- Hono: `createHonoAdapter(mastra, options)`
- Fastify: `createFastifyAdapter(mastra, options)`
- Koa: `createKoaAdapter(mastra, options)`
- Triggers: Server startup
- Responsibilities: Register HTTP routes for agent/workflow execution

**CLI Entry Point:**
- Location: `packages/cli/src/`
- Triggers: `mastra` CLI command
- Responsibilities: Project scaffolding, playground server, development utilities

## Error Handling

**Strategy:** Structured error handling with domain-aware error categorization

**Patterns:**

1. **MastraError Class** - `packages/core/src/error/`
   - Wraps errors with domain, category, ID, and structured details
   - Categories: USER (recoverable), INTERNAL (framework bug), UNKNOWN
   - Domains: MASTRA, LLM, STORAGE, VECTOR, TOOL_EXECUTION
   - Example: `new MastraError({ id: 'AGENT_TOOL_EXECUTION_FAILED', domain: ErrorDomain.TOOL_EXECUTION, category: ErrorCategory.USER })`

2. **Validation Errors** - Schema validation caught and reported with details
   - Tools validate against Zod/JSON Schema
   - Workflows validate step inputs/outputs
   - Processors validate processor configurations

3. **Tool Execution Errors** - Caught and returned as tool error objects
   - Errors don't fail agent execution, instead formatted as tool results
   - Agent can retry or handle gracefully

4. **Processor Abort** - TripWire mechanism allows processors to abort with metadata
   - Processors can call `context.abort(reason, options)` to stop execution
   - Supports retry configuration and custom metadata

5. **Storage Errors** - Wrapped and propagated from storage implementations
   - Could indicate connection issues or data integrity problems
   - Handled differently based on where storage is used

## Cross-Cutting Concerns

**Logging:**
- Multiple logger implementations available (`packages/loggers/`)
- Registered via `logger` config option
- RegisteredLogger singleton provides access throughout framework
- Structured logging with context propagation

**Validation:**
- Zod schemas for type-safe validation
- JSON Schema compatibility layer for cross-platform support
- Tool parameter validation happens at execution time
- Workflow step input/output validation at step boundaries

**Authentication:**
- Integration-level auth: API keys, OAuth tokens managed by integration
- Server-level auth: Simple auth, custom auth handlers in `packages/core/src/server/`
- Auth context available to processors and tools
- Integrations handle provider-specific auth (Stripe, GitHub, etc.)

**Observability:**
- Tracing with span hierarchy (stored in ObservabilityEntrypoint)
- Telemetry decorators for tracking model interactions
- Request context propagates tracing context through call stack
- Supports custom exporters (CloudExporter, DefaultExporter, etc.)

**Caching:**
- Message list caching (embedding cache) in memory system
- Server cache (InMemoryServerCache) for request-scoped temporary storage
- Processor caching for performance optimization
- Tool result caching to avoid duplicate executions

---

*Architecture analysis: 2026-01-26*
