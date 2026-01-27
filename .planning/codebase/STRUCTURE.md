# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
mastra/
├── packages/                    # Core framework packages
│   ├── core/                    # Main framework with agents, workflows, tools
│   ├── cli/                     # Command-line interface
│   ├── playground/              # Web-based development UI
│   ├── server/                  # HTTP server adapter
│   ├── memory/                  # Standalone memory package
│   ├── rag/                     # RAG pipeline components
│   ├── deployer/                # Deployment utilities
│   ├── mcp/                     # Model Context Protocol support
│   ├── evals/                   # Evaluation framework
│   ├── playground-ui/           # Shared UI components
│   ├── auth/                    # Authentication integrations
│   ├── agent-builder/           # Agent configuration builder
│   └── _vendored/               # Vendored dependencies
├── stores/                      # Storage adapter packages
│   ├── pg/                      # PostgreSQL
│   ├── libsql/                  # LibSQL
│   ├── mongodb/                 # MongoDB
│   ├── chroma/                  # Chroma vector store
│   ├── pinecone/                # Pinecone vector store
│   └── ... [other adapters]
├── deployers/                   # Deployment adapters
│   ├── vercel/                  # Vercel deployment
│   ├── netlify/                 # Netlify deployment
│   ├── cloudflare/              # Cloudflare deployment
│   └── cloud/                   # Cloud deployment
├── client-sdks/                 # Client libraries
├── integrations/                # Third-party API integrations
├── examples/                    # Demo applications (excludes from core build)
├── e2e-tests/                   # End-to-end tests
├── docs/                        # Documentation site
├── observability/               # Observability packages
├── templates/                   # Project templates
└── scripts/                     # Build and utility scripts
```

## Directory Purposes

**packages/core/src:**
- Purpose: Main framework implementation with all core abstractions
- Contains: Agents, workflows, tools, memory, storage, LLM integration, streaming
- Key files: `index.ts` exports public API

**packages/core/src/agent:**
- Purpose: Agent class and supporting infrastructure
- Contains: Agent execution (generate/stream), message list management, tool orchestration
- Key files: `agent.ts` (134KB main implementation), `types.ts`, `message-list/index.ts`

**packages/core/src/workflows:**
- Purpose: Workflow orchestration with step execution and state management
- Contains: Workflow class, step definitions, execution engine, event processor
- Key files: `workflow.ts`, `step.ts`, `execution-engine.ts`

**packages/core/src/tools:**
- Purpose: Tool system for LLM function calling
- Contains: Tool class, validation, toolsets, schema handling
- Key files: `tool.ts`, `types.ts`, `tool-builder/`

**packages/core/src/memory:**
- Purpose: Conversation memory with thread-based persistence
- Contains: MastraMemory class, message history, semantic recall, working memory
- Key files: `memory.ts`, `types.ts`, `processors/`

**packages/core/src/storage:**
- Purpose: Storage layer abstraction for persistence
- Contains: Base storage interface, domain-specific stores (memory, workflows, observability)
- Key files: `base.ts`, `index.ts`, `domains/`

**packages/core/src/processors:**
- Purpose: Pluggable middleware for message transformation
- Contains: Input/output processors, processor runner, structured output handling
- Key files: `processors.ts`, `index.ts`, `runner.ts`

**packages/core/src/llm:**
- Purpose: Language model abstraction and provider routing
- Contains: Model routers, AI SDK adapters, gateway configuration
- Key files: `index.ts`, `model/` (contains v4/v5 adapters)

**packages/core/src/stream:**
- Purpose: Event streaming and output formatting
- Contains: Output types, chunk handling, format conversion
- Key files: `base/output.ts`, `types.ts`, `aisdk/` (adapter code)

**packages/core/src/mastra:**
- Purpose: Central orchestration and dependency container
- Contains: Mastra class, configuration, component registration
- Key files: `index.ts` (main implementation)

**packages/core/src/error:**
- Purpose: Structured error types and utilities
- Contains: MastraError class, error domains, error categorization
- Key files: `index.ts`

**packages/core/src/observability:**
- Purpose: Telemetry and tracing
- Contains: Span types, tracing context, entity tracking
- Key files: `types/index.ts`

**packages/core/src/request-context:**
- Purpose: Request-scoped context for multi-tenancy
- Contains: RequestContext class, context key constants
- Key files: `index.ts`

**packages/core/src/loop:**
- Purpose: Agentic loop execution for tool use
- Contains: Agentic loop workflow, execution workflow
- Key files: `workflows/agentic-loop/index.ts`, `workflows/agentic-execution/`

**packages/memory:**
- Purpose: Standalone memory package for external use
- Contains: Memory implementation extracted from core
- Key files: `src/index.ts`

**packages/cli:**
- Purpose: Command-line interface for project management
- Contains: Project creation, playground launch, deployment
- Key files: `src/index.ts`

**packages/playground:**
- Purpose: Web-based development UI for testing agents/workflows
- Contains: React application, chat interface, configuration UI
- Key files: `src/index.ts`, `src/app.tsx`

**stores/[adapter]:**
- Purpose: Storage adapter implementations
- Contains: Database-specific implementations of StorageDomain interface
- Examples: `pg/src/index.ts`, `libsql/src/index.ts`

**deployers/[adapter]:**
- Purpose: Platform-specific deployment adapters
- Contains: Deployment configuration and utilities
- Examples: `vercel/src/index.ts`, `netlify/src/index.ts`

**integrations/[service]:**
- Purpose: Third-party API integrations with OpenAPI support
- Contains: API client code, authentication, tool generation
- Examples: GitHub, Firecrawl, Stripe integrations

**auth/[provider]:**
- Purpose: Authentication provider integrations
- Contains: OAuth/credential handling for identity providers
- Examples: GitHub, Google, custom JWT auth

## Key File Locations

**Entry Points:**
- `packages/core/src/index.ts`: Public API exports (Mastra, Agent, Workflow, etc.)
- `packages/core/src/mastra/index.ts`: Mastra orchestration class definition
- `packages/cli/src/index.ts`: CLI entry point
- `packages/playground/src/index.ts`: Playground server entry

**Configuration:**
- `packages/core/src/mastra/index.ts`: Config interface definitions
- `tsconfig.json`: TypeScript configuration (root)
- `tsconfig.build.json`: Build-specific TypeScript config
- `turbo.json`: Monorepo task orchestration

**Core Logic:**
- `packages/core/src/agent/agent.ts`: Agent class (primary interaction)
- `packages/core/src/workflows/workflow.ts`: Workflow execution engine
- `packages/core/src/tools/tool.ts`: Tool abstraction
- `packages/core/src/memory/memory.ts`: Memory system
- `packages/core/src/loop/workflows/agentic-loop/`: Tool-use loop implementation

**Testing:**
- `packages/core/src/agent/agent.test.ts`: Agent tests (255KB, comprehensive)
- `packages/core/src/workflows/workflow.test.ts`: Workflow tests
- `vitest.config.observability.ts`: Observability test config

**Utilities:**
- `packages/core/src/utils.ts`: Shared utility functions
- `packages/core/src/logger/`: Logging utilities
- `packages/core/src/error/`: Error handling utilities

## Naming Conventions

**Files:**
- `.ts` for source files (not `.js`)
- `.test.ts` for test files (co-located with implementation)
- `index.ts` for directory exports (barrel pattern)
- Descriptive names: `agent.ts`, `message-list.ts`, `processor-runner.ts`

**Directories:**
- kebab-case for directory names: `message-list/`, `agentic-loop/`, `tool-loop-agent/`
- Plural for collections: `agents/`, `tools/`, `processors/`, `workflows/`
- Domain-specific grouping: `storage/domains/`, `llm/model/`, `stream/aisdk/`

**Functions:**
- camelCase: `createAgent()`, `generateText()`, `executeWorkflow()`
- Verb-first for side effects: `initStorage()`, `saveMessage()`, `clearAll()`
- Predicate functions start with is/has: `isProcessor()`, `hasOpenAIReasoning()`

**Classes:**
- PascalCase: `Agent`, `Mastra`, `MessageList`, `MastraError`
- Suffixes for type: `*Processor`, `*Store`, `*Adapter`, `*Schema`

**Types:**
- PascalCase: `AgentConfig`, `WorkflowResult`, `MastraVector`
- Generic type prefix: `T*` for type parameters: `TAgents`, `TWorkflows`

**Constants:**
- UPPER_SNAKE_CASE: `MASTRA_RESOURCE_ID_KEY`, `MASTRA_THREAD_ID_KEY`
- Enum values: `ErrorDomain.AGENT`, `EntityType.AGENT`

## Where to Add New Code

**New Feature in Agent:**
- Primary code: `packages/core/src/agent/agent.ts`
- Types: `packages/core/src/agent/types.ts`
- Tests: `packages/core/src/agent/agent.test.ts`

**New Component/Module:**
- Implementation: `packages/core/src/[module-name]/index.ts`
- Types: `packages/core/src/[module-name]/types.ts`
- Tests: `packages/core/src/[module-name]/[module-name].test.ts`
- Export from: `packages/core/src/index.ts`

**New Processor:**
- Implementation: `packages/core/src/processors/processors/[name].ts`
- Types: Add to `packages/core/src/processors/processors.ts`
- Export from: `packages/core/src/processors/index.ts`

**New Storage Domain:**
- Implementation: `packages/core/src/storage/domains/[domain]/base.ts`
- In-memory variant: `packages/core/src/storage/domains/[domain]/inmemory.ts`
- Index: `packages/core/src/storage/domains/[domain]/index.ts`
- Adapter: Implement StorageDomain in `stores/[db]/src/[domain].ts`

**Utilities:**
- Shared helpers: `packages/core/src/utils.ts`
- Domain-specific utils: `packages/core/src/[module]/utils.ts`
- Path-based organization: `packages/core/src/agent/message-list/utils/`

**New Workflow:**
- Step definition: `packages/core/src/workflows/workflows/[name].ts` (if framework-provided)
- User workflows: In application code, not in core

**New Integration:**
- Implementation: `integrations/[service]/src/index.ts`
- Tests: `integrations/[service]/src/[service].test.ts`
- Configuration: `integrations/[service]/package.json`

**New Storage Adapter:**
- Implementation: `stores/[database]/src/index.ts`
- Domain implementations: `stores/[database]/src/[domain].ts`
- Tests: `stores/[database]/src/[database].test.ts`

## Special Directories

**packages/core/src/agent/message-list:**
- Purpose: Complex message abstraction handling v1, v4, v5 formats
- Generated: No
- Committed: Yes
- Subdirectories: `adapters/`, `conversion/`, `detection/`, `merge/`, `prompt/`, `state/`, `utils/`

**packages/core/src/loop:**
- Purpose: Agentic loop implementation for tool use
- Generated: No
- Committed: Yes
- Subdirectories: `workflows/`, `network/`, `test-utils/`

**packages/core/src/_types:**
- Purpose: Internal type definitions
- Generated: No
- Committed: Yes

**packages/_vendored:**
- Purpose: Vendored dependencies that need modification
- Generated: No
- Committed: Yes

**stores/:**
- Purpose: Storage adapters (not application code)
- Generated: No
- Committed: Yes
- Important: Build artifacts go to `dist/` in each adapter

**examples/:**
- Purpose: Demo applications (excluded from core build per CLAUDE.md)
- Generated: No
- Committed: Yes
- Pattern: Each example is self-contained with own dependencies

**e2e-tests/:**
- Purpose: End-to-end integration tests
- Generated: No
- Committed: Yes
- Key: Tests require Docker services running (`pnpm dev:services:up`)

**dist/:**
- Purpose: Build output (TypeScript compiled to JavaScript)
- Generated: Yes
- Committed: No
- Pattern: Created by `pnpm build`, consumed by `pnpm dev` and deployment

**.changeset/:**
- Purpose: Changeset files for version management
- Generated: Manually created per contribution
- Committed: Yes
- Pattern: Each PR creates changeset(s) describing changes

---

*Structure analysis: 2026-01-27*
