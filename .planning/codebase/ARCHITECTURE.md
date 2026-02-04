# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Plugin-based Monorepo with Central Orchestration

**Key Characteristics:**

- Central `Mastra` class acts as DI container and registry for all components
- Pluggable adapters pattern: storage, vectors, memory, deployers, server adapters
- TypeScript-first with strict typing across all packages
- Modular package structure with clear dependency boundaries

## Layers

**Core Framework (`packages/core/`):**

- Purpose: Central orchestration, base abstractions, shared types
- Location: `packages/core/src/`
- Contains: `Mastra` class, `Agent`, `Workflow`, `Tool`, storage interfaces, memory interfaces
- Depends on: Nothing external to core
- Used by: All other packages

**Server Layer (`packages/server/`, `server-adapters/`):**

- Purpose: HTTP API handlers and framework adapters
- Location: `packages/server/src/server/`, `server-adapters/{hono,express,fastify,koa}/`
- Contains: Route handlers, middleware, auth integration, streaming
- Depends on: `@mastra/core`
- Used by: Deployed applications

**Storage Layer (`stores/`):**

- Purpose: Persistent data storage implementations
- Location: `stores/{pg,libsql,mongodb,...}/src/`
- Contains: Database adapters implementing `MastraCompositeStore`
- Depends on: `@mastra/core/storage` interfaces
- Used by: `Mastra` instance via `storage` config

**Memory Layer (`packages/memory/`):**

- Purpose: Conversation memory with semantic recall
- Location: `packages/memory/src/`
- Contains: `Memory` class extending `MastraMemory`
- Depends on: `@mastra/core/memory`, vector stores, embedders
- Used by: Agents for context persistence

**Vector Layer (`packages/core/src/vector/`, vector stores):**

- Purpose: Semantic search and embeddings storage
- Location: `packages/core/src/vector/`, `stores/{pinecone,chroma,...}/`
- Contains: `MastraVector` interface, vector store implementations
- Depends on: Embedding models
- Used by: Memory for semantic recall, RAG

**Workflow Layer (`packages/core/src/workflows/`):**

- Purpose: Step-based task execution with suspend/resume
- Location: `packages/core/src/workflows/`
- Contains: `Workflow`, `Step`, execution engine, event processing
- Depends on: Storage for run persistence, agents for AI steps
- Used by: Orchestrated multi-step processes

**Auth Layer (`packages/auth/`, `auth/`):**

- Purpose: Authentication provider integrations
- Location: `packages/auth/src/`, `auth/{workos,supabase,auth0,...}/`
- Contains: JWT utilities, auth provider adapters
- Depends on: Auth provider SDKs
- Used by: Server middleware for request authentication

## Data Flow

**Agent Request Flow:**

1. HTTP request hits server adapter (`server-adapters/hono/`)
2. Auth middleware validates session/token
3. Context middleware creates `RequestContext`
4. Handler calls `mastra.getAgent(id).stream()`
5. Agent resolves tools, memory, model config
6. LLM call with streaming response
7. Memory saves messages post-completion
8. Stream chunks sent to client

**Workflow Execution Flow:**

1. `workflow.execute(input)` creates run
2. Execution engine traverses step graph
3. Each step executes with context
4. Suspend/resume via storage persistence
5. Event processor handles async notifications
6. Final output returned

**State Management:**

- Request-scoped via `RequestContext` (AsyncLocalStorage)
- Thread-scoped via Memory storage
- Workflow state via storage `workflow_runs` domain
- Application config via `Mastra` instance

## Key Abstractions

**Mastra (Central Registry):**

- Purpose: DI container, component registry, configuration hub
- Examples: `packages/core/src/mastra/index.ts`
- Pattern: Constructor injection, lazy initialization

**Agent:**

- Purpose: AI interaction abstraction with tools, memory, model
- Examples: `packages/core/src/agent/agent.ts`
- Pattern: Builder pattern via config, streaming execution

**Tool:**

- Purpose: Callable function for agents with schema validation
- Examples: `packages/core/src/tools/tool.ts`
- Pattern: Schema-first definition, execute function

**Workflow:**

- Purpose: DAG-based step execution with type-safe data flow
- Examples: `packages/core/src/workflows/workflow.ts`
- Pattern: Builder pattern, immutable step definitions

**MastraCompositeStore:**

- Purpose: Multi-domain storage abstraction
- Examples: `packages/core/src/storage/base.ts`
- Pattern: Domain-based storage composition

## Entry Points

**CLI Entry:**

- Location: `packages/cli/src/index.ts`
- Triggers: `mastra` command
- Responsibilities: Dev server, build, deploy commands

**Server Entry:**

- Location: `server-adapters/hono/src/index.ts`
- Triggers: HTTP requests
- Responsibilities: Route registration, middleware chain, request handling

**Core Entry:**

- Location: `packages/core/src/index.ts`
- Triggers: Import `@mastra/core`
- Responsibilities: Exports `Mastra` class and `Config` type

## Error Handling

**Strategy:** Domain-specific error classes with categorization

**Patterns:**

- `MastraError` with `ErrorDomain`, `ErrorCategory`
- HTTP exceptions for server layer
- Zod validation errors for schema failures
- Async error propagation with telemetry tracking

## Cross-Cutting Concerns

**Logging:** Pluggable logger interface (`IMastraLogger`), default `ConsoleLogger`
**Validation:** Zod schemas throughout, JSON Schema conversion for agents
**Authentication:** Middleware-based, provider-agnostic via auth adapters
**Observability:** OpenTelemetry integration via `@mastra/observability`

---

_Architecture analysis: 2026-01-27_
