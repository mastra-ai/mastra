# Codebase Structure

**Analysis Date:** 2026-01-23

## Directory Layout

```
project-root/
├── packages/                    # Core framework packages
│   ├── core/                    # Main Mastra framework
│   ├── cli/                     # Command-line interface
│   ├── server/                  # HTTP server integration
│   ├── mcp/                     # Model Context Protocol
│   ├── memory/                  # Memory package (separate from core)
│   ├── rag/                     # Retrieval-augmented generation
│   ├── evals/                   # Evaluation framework
│   ├── deployer/                # Deployment adapters
│   ├── playground/              # Dev environment UI
│   ├── playground-ui/           # Playground components
│   ├── agent-builder/           # Agent configuration UI
│   ├── auth/                    # Auth provider integration
│   ├── loggers/                 # Logger implementations
│   ├── fastembed/               # Fast embedding model
│   ├── schema-compat/           # AI SDK schema compatibility
│   ├── create-mastra/           # Project scaffolding
│   ├── _config/                 # Shared config utilities
│   ├── _external-types/         # External type definitions
│   ├── _vendored/               # Vendored dependencies
│   └── _types-builder/          # Type generation utilities
├── stores/                      # Storage adapter implementations
│   ├── pg/                      # PostgreSQL adapter
│   ├── libsql/                  # LibSQL/Turso adapter
│   ├── mongodb/                 # MongoDB adapter
│   ├── chroma/                  # Chroma vector store
│   ├── pinecone/                # Pinecone vector store
│   ├── qdrant/                  # Qdrant vector store
│   ├── lance/                   # Lance vector store
│   ├── cloudflare-d1/           # Cloudflare D1 adapter
│   ├── cloudflare/              # Cloudflare Workers KV
│   ├── opensearch/              # OpenSearch adapter
│   ├── clickhouse/              # ClickHouse adapter
│   ├── dynamodb/                # DynamoDB adapter
│   ├── convex/                  # Convex adapter
│   ├── turbopuffer/             # TurboBuffer vector store
│   └── _test-utils/             # Test utilities for stores
├── server-adapters/             # HTTP framework adapters
│   ├── express/                 # Express.js adapter
│   ├── hono/                    # Hono adapter
│   ├── fastify/                 # Fastify adapter
│   ├── koa/                     # Koa adapter
│   └── _test-utils/             # Test utilities
├── deployers/                   # Deployment platform adapters
│   ├── vercel/                  # Vercel adapter
│   ├── netlify/                 # Netlify adapter
│   ├── cloudflare/              # Cloudflare adapter
│   └── cloud/                   # Generic cloud adapter
├── auth/                        # Authentication integrations
│   ├── supabase/                # Supabase Auth adapter
│   ├── firebase/                # Firebase Auth adapter
│   ├── clerk/                   # Clerk adapter
│   ├── workos/                  # WorkOS adapter
│   ├── auth0/                   # Auth0 adapter
│   └── better-auth/             # Better-auth adapter
├── client-sdks/                 # Client libraries
│   ├── client-js/               # JavaScript/Node.js client
│   ├── react/                   # React hooks
│   └── ai-sdk/                  # Vercel AI SDK integration
├── observability/               # Observability implementations
│   └── [exporters]/             # Datadog, HoneyComb, etc.
├── speech/                      # Speech processing
│   └── [speech-modules]/        # TTS, STT implementations
├── docs/                        # Documentation site (Next.js)
│   └── src/
│       ├── course/              # Tutorial content
│       └── [pages]/             # API reference, guides
├── e2e-tests/                   # End-to-end tests
├── examples/                    # Demo applications
├── explorations/                # Experimental features
├── .planning/                   # GSD planning documents
│   └── codebase/                # Codebase analysis docs
├── .claude/                     # Claude Code instructions
├── .cursor/                     # Cursor IDE rules
├── turbo.json                   # Turbo build configuration
├── package.json                 # Root workspace manifest
└── pnpm-lock.yaml               # Dependency lock file
```

## Directory Purposes

**packages/core/src/**
- Purpose: Main framework (agent, workflow, storage, tools, memory)
- Core abstractions: `Mastra`, `Agent`, `Workflow`, `Tool`, `Processor`
- Key files: `mastra/`, `agent/`, `workflows/`, `tools/`, `processors/`, `storage/`

**packages/core/src/mastra/**
- Purpose: Central orchestration hub (dependency injection, config)
- Key files: `index.ts` (Config interface, Mastra class definition)
- Exports: `Mastra` class only via `packages/core/src/index.ts`

**packages/core/src/agent/**
- Purpose: AI agent abstraction with execution pipeline
- Key subdirs: `message-list/` (message state), `save-queue/` (async persistence), `workflows/` (step integration)
- Key files: `agent.ts` (Agent class), `types.ts` (AgentConfig, execution options)

**packages/core/src/workflows/**
- Purpose: Step-based task orchestration
- Key files: `workflow.ts` (Workflow class), `step.ts` (createStep overloads), `execution-engine.ts` (default engine)
- Subdirs: `evented/` (event streaming), `handlers/` (step execution handlers)

**packages/core/src/tools/**
- Purpose: Tool abstraction for agent/workflow execution
- Key files: `tool.ts` (Tool class), `types.ts` (ToolAction interface), `validation.ts` (schema validation)
- Pattern: Tools are composable, can be created with `createTool()`

**packages/core/src/processors/**
- Purpose: Message/chunk transformation pipeline stages
- Key files: `index.ts` (Processor interface, stage types), `runner.ts` (ProcessorRunner), `processors/` (implementations)
- Subdirs: `memory/` (MessageHistory, WorkingMemory, SemanticRecall)

**packages/core/src/storage/**
- Purpose: Unified storage interface with pluggable backends
- Key files: `base.ts` (MastraCompositeStore), `types.ts` (StorageDomains), `domains/` (domain-specific interfaces)
- Domains: `workflows`, `memory`, `scores`, `agents`, `observability`

**packages/core/src/llm/**
- Purpose: LLM provider abstraction and model routing
- Key files: `index.ts` (re-exports), `model/` (LLM implementation)
- Subdirs: `model/gateways/` (gateway implementations: Netlify, Azure, models.dev)

**packages/core/src/memory/**
- Purpose: Conversation history and semantic recall
- Key files: `memory.ts` (MastraMemory class), `types.ts` (MemoryConfig)
- Integration: Memory processors (MessageHistory, WorkingMemory, SemanticRecall)

**packages/core/src/vector/**
- Purpose: Vector store abstraction for semantic search
- Key files: Types only; implementations in `stores/` directory

**packages/core/src/request-context/**
- Purpose: Request-scoped state container
- Key files: `index.ts` (RequestContext class with set/get/has/delete)
- Constants: `MASTRA_RESOURCE_ID_KEY`, `MASTRA_THREAD_ID_KEY` for auth/threading

**packages/core/src/loop/**
- Purpose: Agentic loop implementation (LLM → tools → LLM)
- Key files: `loop.ts` (core loop logic), `network/` (multi-agent routing)

**packages/core/src/error/**
- Purpose: Typed error framework
- Key files: `index.ts` (MastraError class, ErrorDomain, ErrorCategory enums)

**packages/core/src/observability/**
- Purpose: Tracing and span export interfaces
- Framework: Zod schemas, optional integration with @mastra/observability

**stores/** (all subdirectories)
- Purpose: Storage adapter implementations
- Pattern: Each extends `MastraCompositeStore`, implements `StorageDomains`
- Examples: `pg/src/index.ts`, `libsql/src/index.ts`

**server-adapters/** (Express, Hono, Fastify, Koa)
- Purpose: HTTP framework integration
- Pattern: Each provides route handler, middleware, context management

**deployers/** (Vercel, Netlify, Cloudflare, cloud)
- Purpose: Platform-specific deployment helpers
- Location: `packages/deployer/src/` (main logic), individual deployers extend this

**auth/** (all subdirectories)
- Purpose: Authentication provider integrations
- Pattern: Each wraps provider OAuth/API with Mastra interfaces

**client-sdks/**
- Purpose: Client libraries for different platforms
- `client-js/`: Node.js/browser client
- `react/`: React hooks for Mastra agents
- `ai-sdk/`: Vercel AI SDK integration

**docs/**
- Purpose: Documentation site (Next.js + MDX)
- Course: Tutorial and learning materials in `src/course/`
- References: API docs generated from code comments

**e2e-tests/**
- Purpose: End-to-end test suite
- Pattern: Full integration tests with Docker services

**examples/**
- Purpose: Demo applications showing Mastra usage
- Note: Excluded from default builds per CLAUDE.md

## Key File Locations

**Entry Points:**

- `packages/core/src/index.ts`: Framework entry (exports Mastra class)
- `packages/core/src/mastra/index.ts`: Mastra class definition with Config interface
- `packages/core/src/agent/index.ts`: Agent exports
- `packages/core/src/workflows/index.ts`: Workflow exports
- `packages/core/src/tools/index.ts`: Tool exports
- `packages/core/src/storage/index.ts`: Storage base and types

**Core Logic:**

- `packages/core/src/agent/agent.ts`: Agent class (generate, stream, network methods)
- `packages/core/src/workflows/workflow.ts`: Workflow class (execute method)
- `packages/core/src/tools/tool.ts`: Tool class
- `packages/core/src/processors/index.ts`: Processor interface definition
- `packages/core/src/loop/loop.ts`: Agentic loop implementation
- `packages/core/src/agent/message-list/`: Message state management
- `packages/core/src/request-context/index.ts`: RequestContext class

**Configuration:**

- `tsconfig.json`: TypeScript configuration
- `.prettierrc`: Prettier formatting config
- `.turbo/`: Turbo build cache
- `turbo.json`: Build dependency graph
- `packages/core/package.json`: Core package metadata

**Testing:**

- `packages/core/src/**/*.test.ts`: Co-located unit tests
- `packages/core/src/**/*.test-d.ts`: Type tests (tsd)
- `e2e-tests/`: Full integration test suite
- `stores/_test-utils/`: Test utilities for storage implementations

## Naming Conventions

**Files:**

- `index.ts`: Barrel exports or main entry point
- `{name}.ts`: Implementation (e.g., `agent.ts`, `tool.ts`, `workflow.ts`)
- `{name}.types.ts` or `types.ts`: Type definitions (e.g., `agent.types.ts`, `processors/index.ts` has types)
- `{name}.test.ts`: Unit tests (e.g., `agent.test.ts`)
- `{name}.test-d.ts`: Type definition tests (e.g., `request-context.test-d.ts`)

**Directories:**

- `src/`: Source code root (TypeScript)
- `dist/`: Compiled output (ESM)
- `[feature]/`: Feature grouping by domain (agent, workflows, tools, etc.)
- `__tests__/`: Test directory (co-located or grouped)
- `__snapshots__/`: Vitest snapshots

**Exports:**

- Named exports for types and functions: `export type AgentConfig`, `export class Agent`
- Barrel files re-export: `export * from './agent'`
- Default not used; all exports are named

**Package Names:**

- Core: `@mastra/core`
- Feature packages: `@mastra/{feature}` (e.g., `@mastra/memory`, `@mastra/rag`, `@mastra/evals`)
- Adapters: Namespaced by category (stores, server-adapters, deployers, auth)
- Internal: `@internal/{package}` for private packages (schema-compat, vendored)

## Where to Add New Code

**New Agent Feature:**
- Implementation: `packages/core/src/agent/{feature}.ts`
- Tests: `packages/core/src/agent/{feature}.test.ts` or `packages/core/src/agent/__tests__/{feature}.test.ts`
- Exports: Add to `packages/core/src/agent/index.ts`

**New Workflow Capability:**
- Implementation: `packages/core/src/workflows/{feature}.ts`
- Tests: `packages/core/src/workflows/__tests__/{feature}.test.ts`
- Exports: Add to `packages/core/src/workflows/index.ts`

**New Tool Type/Validation:**
- Implementation: `packages/core/src/tools/{feature}.ts`
- Tests: `packages/core/src/tools/__tests__/{feature}.test.ts`

**New Processor Stage:**
- Implementation: `packages/core/src/processors/{feature}.ts` or `processors/processors/{feature}.ts`
- Memory processors: `packages/core/src/processors/memory/{processor-name}.ts`

**New Storage Domain:**
- Interface: `packages/core/src/storage/domains/{domain-name}.ts`
- Implementations per adapter: `stores/{adapter}/src/{domain-name}.ts`

**New Server Adapter:**
- Create: `server-adapters/{framework}/src/index.ts`
- Pattern: Export handler function, middleware, context setup
- Follow: `server-adapters/express/`, `server-adapters/hono/` patterns

**New Authentication Provider:**
- Create: `auth/{provider}/src/index.ts`
- Exports: Provider class extending auth base

**New Storage Implementation:**
- Create: `stores/{provider}/src/index.ts`
- Implement: All domains required (workflows, memory, scores, optional: agents, observability)
- Pattern: Extend `MastraCompositeStore`, set `this.stores`

**Shared Utilities:**
- Core helpers: `packages/core/src/utils.ts` or `utils/` subdirectory
- Constants: `packages/core/src/constants.ts` or feature-specific
- Types: Keep close to usage; only move to `_types/` if widely shared

**Observability:**
- Implementations: `observability/{exporter}/src/index.ts`
- Types/interfaces: `packages/core/src/observability/types/`

## Special Directories

**packages/core/src/_types/**
- Purpose: Internal type definitions shared across packages
- Generated: Yes (via `_types-builder`)
- Committed: Yes

**packages/_vendored/**
- Purpose: Vendored third-party code for compatibility
- Generated: No
- Committed: Yes

**packages/playground/**
- Purpose: Development testing environment
- Generated: No
- Committed: Yes
- Note: Separate UI in `packages/playground-ui/`

**stores/** (all subdirectories)
- Purpose: Independent storage adapter packages
- Dependency: All extend core `packages/core/src/storage/`
- Build: Built via `pnpm build:combined-stores`

**.planning/codebase/**
- Purpose: GSD codebase analysis and planning documents
- Generated: By GSD map-codebase command
- Committed: Yes (results of analysis)

**docs/src/course/**
- Purpose: Tutorial and learning materials
- Format: MDX with code examples
- Build: Part of docs site (Next.js)

**e2e-tests/**
- Purpose: Full integration test suite
- Services: Requires Docker (postgres, redis, etc.)
- Run: `pnpm dev:services:up` then `pnpm test:e2e`

---

*Structure analysis: 2026-01-23*
