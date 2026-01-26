# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Central Orchestration with Dependency Injection

**Key Characteristics:**

- Central `Mastra` class acts as orchestrator and service registry
- Components register with Mastra for dependency resolution
- Plugin architecture with pluggable storage, vectors, memory, deployers
- Request-scoped context propagation for dynamic configuration
- Event-driven communication via pub/sub system
- Modular monorepo with domain-specific packages

## Layers

**Core Layer:**

- Purpose: Framework foundation - base classes, types, and shared utilities
- Location: `packages/core/src/`
- Contains: MastraBase, error handling, logging, request context
- Depends on: None (foundation layer)
- Used by: All other layers

**Orchestration Layer:**

- Purpose: Central coordination of all components
- Location: `packages/core/src/mastra/`
- Contains: Mastra class (service registry, dependency injection)
- Depends on: Core layer, all component layers
- Used by: Server layer, application entry points

**Agent Layer:**

- Purpose: AI agent abstraction with tools, memory, and voice
- Location: `packages/core/src/agent/`
- Contains: Agent class, MessageList, TripWire, agent workflows
- Depends on: Core layer, LLM layer, Tools layer, Memory layer
- Used by: Orchestration layer, Workflows layer

**Workflow Layer:**

- Purpose: Step-based execution with suspend/resume capabilities
- Location: `packages/core/src/workflows/`
- Contains: Workflow, createStep, createWorkflow, ExecutionEngine
- Depends on: Core layer, Events layer, Storage layer
- Used by: Agent layer (as workflow steps), Orchestration layer

**Storage Layer:**

- Purpose: Pluggable persistence backends
- Location: `packages/core/src/storage/` and `stores/*/`
- Contains: MastraCompositeStore, domain stores (workflows, memory, agents, scores)
- Depends on: Core layer
- Used by: Memory layer, Workflow layer, Agent layer

**Memory Layer:**

- Purpose: Thread-based conversation persistence with semantic recall
- Location: `packages/core/src/memory/` and `packages/memory/`
- Contains: MastraMemory base class, Memory implementation, working memory tools
- Depends on: Core layer, Storage layer, Vector layer
- Used by: Agent layer

**Tools Layer:**

- Purpose: Dynamic tool composition from multiple sources
- Location: `packages/core/src/tools/`
- Contains: Tool class, createTool, ToolAction types
- Depends on: Core layer
- Used by: Agent layer, MCP layer

**Server Layer:**

- Purpose: HTTP API and request handling
- Location: `packages/server/src/` and `server-adapters/*/`
- Contains: Handlers, schemas, server adapters (Express, Hono, Fastify, Koa)
- Depends on: Orchestration layer
- Used by: CLI (dev server), deployment targets

**LLM Layer:**

- Purpose: Language model abstraction and routing
- Location: `packages/core/src/llm/`
- Contains: Model router, model configs, gateways
- Depends on: Core layer
- Used by: Agent layer

**Events Layer:**

- Purpose: Pub/sub for event-driven communication
- Location: `packages/core/src/events/`
- Contains: PubSub abstract class, EventEmitterPubSub
- Depends on: Core layer
- Used by: Workflow layer, Orchestration layer

## Data Flow

**Agent Generation Flow:**

1. User calls `agent.generate()` or `agent.stream()`
2. Agent resolves model via model router (`packages/core/src/llm/model/router.ts`)
3. Tools composed from assigned tools, memory tools, toolsets, and MCP
4. Instructions resolved (static or dynamic)
5. LLM call made via agentic loop (`packages/core/src/loop/`)
6. If memory enabled, messages saved to storage
7. Response returned with streaming support

**Workflow Execution Flow:**

1. Workflow triggered via `workflow.createRun().start()`
2. ExecutionEngine (`packages/core/src/workflows/execution-engine.ts`) processes step graph
3. Each step executes via `execute()` function
4. Steps can suspend (human-in-the-loop) and resume later
5. Events published to pub/sub for monitoring
6. Results persisted to storage for durability
7. Workflow completes with final result

**Memory Recall Flow:**

1. Agent calls `memory.recall()` with threadId
2. Memory retrieves messages from storage domain
3. If semantic recall enabled, vector search performed
4. Messages merged with semantic results
5. Working memory injected if enabled
6. Messages returned to agent for context

**State Management:**

- Request-scoped state via `RequestContext` (`packages/core/src/request-context/`)
- Workflow state persisted to storage between steps
- Working memory persists across conversations (thread or resource scoped)
- Agent conversation history via thread-based storage

## Key Abstractions

**Mastra:**

- Purpose: Central orchestrator and service registry
- Examples: `packages/core/src/mastra/index.ts`
- Pattern: Dependency injection container, factory methods for all components

**Agent:**

- Purpose: AI interaction abstraction with tools and memory
- Examples: `packages/core/src/agent/agent.ts`
- Pattern: Configurable behavior via constructor options, model router for LLM selection

**Workflow:**

- Purpose: Multi-step execution with control flow
- Examples: `packages/core/src/workflows/workflow.ts`
- Pattern: Builder pattern for step composition, execution engine for processing

**Tool:**

- Purpose: Callable actions for agents and workflows
- Examples: `packages/core/src/tools/tool.ts`
- Pattern: Schema-validated input/output, optional approval workflow

**MastraCompositeStore:**

- Purpose: Storage abstraction with domain separation
- Examples: `packages/core/src/storage/base.ts`
- Pattern: Composite pattern for mixing storage backends per domain

**MastraMemory:**

- Purpose: Conversation memory with semantic recall
- Examples: `packages/core/src/memory/memory.ts`, `packages/memory/src/index.ts`
- Pattern: Template method for storage operations, strategy for embedding

**ExecutionEngine:**

- Purpose: Workflow step execution orchestration
- Examples: `packages/core/src/workflows/execution-engine.ts`
- Pattern: Strategy pattern for execution logic, observer for lifecycle callbacks

## Entry Points

**CLI Entry:**

- Location: `packages/cli/src/index.ts`
- Triggers: `mastra` CLI commands (create, init, dev, build, etc.)
- Responsibilities: Project scaffolding, dev server, deployment

**Server Entry:**

- Location: `packages/server/src/server/handlers/`
- Triggers: HTTP requests via server adapters
- Responsibilities: Route to appropriate handlers (agents, tools, workflows)

**Mastra Constructor:**

- Location: `packages/core/src/mastra/index.ts`
- Triggers: Application initialization
- Responsibilities: Register all components, wire dependencies

**Playground Entry:**

- Location: `packages/playground/`
- Triggers: `mastra studio` command
- Responsibilities: Development UI for testing agents and workflows

## Error Handling

**Strategy:** Structured errors with domain and category classification

**Patterns:**

- `MastraError` class with id, domain, category, text, details (`packages/core/src/error/`)
- Domains: MASTRA, AGENT, WORKFLOW, STORAGE, etc.
- Categories: USER (client error), SYSTEM (internal error)
- TripWire for controlled workflow abort with retry support
- Lifecycle callbacks (onFinish, onError) for workflow error handling

## Cross-Cutting Concerns

**Logging:**

- IMastraLogger interface with ConsoleLogger default
- Component-tagged logging via MastraBase
- LogLevel control (INFO/WARN/ERROR/DEBUG)
- Location: `packages/core/src/logger/`

**Validation:**

- Zod schemas for input/output validation
- Schema validation in tools, workflows, and API handlers
- zodToJsonSchema for schema serialization

**Authentication:**

- Auth middleware integration via server adapters
- RequestContext for propagating auth state
- Auth provider packages: `auth/clerk`, `auth/supabase`, `auth/auth0`, etc.

**Observability:**

- TracingContext for request tracing
- Span types: AGENT, WORKFLOW, TOOL, LLM, etc.
- External integrations: `observability/langfuse`, `observability/langsmith`, etc.
- Location: `packages/core/src/observability/`, `observability/*/`

---

_Architecture analysis: 2026-01-26_
