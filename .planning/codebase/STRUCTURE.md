# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
project-root/
├── packages/                      # Core framework and integrated packages
│   ├── core/                      # Central framework (Mastra, Agent, Workflow, etc.)
│   ├── cli/                       # Command-line interface
│   ├── server/                    # HTTP server integration
│   ├── playground/                # Development playground application
│   ├── playground-ui/             # Playground UI components
│   ├── mcp/                       # Model Context Protocol support
│   ├── memory/                    # Memory package with semantic recall
│   ├── rag/                       # Retrieval-augmented generation
│   ├── evals/                     # Evaluation and scoring framework
│   ├── loggers/                   # Logger implementations (Pino, Console, etc.)
│   ├── deployer/                  # Deployment infrastructure
│   ├── auth/                      # Authentication integrations
│   ├── agent-builder/             # Agent building utilities
│   ├── schema-compat/             # JSON Schema compatibility layer
│   ├── codemod/                   # Automated code transformation tools
│   ├── create-mastra/             # Project scaffolding
│   ├── fastembed/                 # Fast embedding provider
│   ├── mcp-docs-server/           # MCP documentation server
│   ├── mcp-registry-registry/     # MCP registry
│   ├── _config/                   # Shared configuration
│   ├── _external-types/           # External type definitions
│   ├── _types-builder/            # Type generation utilities
│   ├── _vendored/                 # Vendored dependencies
│   └── _changeset-cli/            # Changelog management
│
├── stores/                        # Storage adapters (25+ implementations)
│   ├── pg/                        # PostgreSQL adapter
│   ├── mongodb/                   # MongoDB adapter
│   ├── dynamodb/                  # AWS DynamoDB adapter
│   ├── chroma/                    # Chroma vector store adapter
│   ├── pinecone/                  # Pinecone vector store adapter
│   ├── libsql/                    # LibSQL adapter
│   ├── duckdb/                    # DuckDB adapter
│   ├── cloudflare-d1/             # Cloudflare D1 adapter
│   ├── elasticsearch/             # Elasticsearch adapter
│   └── [20+ more adapters]        # Additional storage backends
│
├── server-adapters/               # HTTP server framework adapters
│   ├── express/                   # Express.js adapter
│   ├── hono/                      # Hono adapter
│   ├── fastify/                   # Fastify adapter
│   ├── koa/                       # Koa adapter
│   └── _test-utils/               # Testing utilities
│
├── deployers/                     # Deployment platform adapters
│   ├── vercel/                    # Vercel deployment
│   ├── netlify/                   # Netlify deployment
│   ├── cloudflare/                # Cloudflare Workers deployment
│   └── cloud/                     # Mastra Cloud deployment
│
├── voice/                         # Voice synthesis and recognition
│   └── [speech processing packages]
│
├── client-sdks/                   # Client libraries for consuming Mastra
│   ├── client-js/                 # JavaScript/TypeScript client
│   ├── ai-sdk/                    # Vercel AI SDK integration
│   └── react/                     # React hooks and components
│
├── auth/                          # Authentication provider integrations
│   ├── supabase/                  # Supabase auth
│   ├── firebase/                  # Firebase auth
│   ├── clerk/                     # Clerk auth
│   ├── auth0/                     # Auth0 integration
│   ├── workos/                    # WorkOS integration
│   └── better-auth/               # Better Auth integration
│
├── integrations/                  # Third-party API integrations
│   └── [OpenAPI-based integrations]
│
├── observability/                 # Observability and tracing
│   └── [observability packages]
│
├── workflows/                     # Workflow examples and utilities
├── pubsub/                        # Pub/Sub implementations
├── e2e-tests/                     # End-to-end test suites
├── examples/                      # Example applications
├── docs/                          # Documentation site (Next.js)
├── templates/                     # Project templates
├── explorations/                  # Experimental features
├── .planning/                     # GSD planning documents
├── .changeset/                    # Changeset entries for releases
├── .claude/                       # Claude-specific context
├── .cursor/                       # Cursor IDE configuration
├── scripts/                       # Build and utility scripts
├── patches/                       # Patch files for dependencies
├── pnpm-workspace.yaml            # Monorepo workspace configuration
├── turbo.json                     # Turbo build configuration
├── tsconfig.json                  # TypeScript configuration
└── package.json                   # Root package manifest
```

## Directory Purposes

**`packages/core/`:**
- Purpose: Central framework containing Mastra class and all core abstractions
- Contains: Agent, Workflow, Tools, Memory, Storage interfaces, LLM routing, Processors, Message lists
- Key files: `src/mastra/index.ts`, `src/agent/agent.ts`, `src/workflows/workflow.ts`
- Imported by: All other packages; the foundation of Mastra

**`packages/memory/`:**
- Purpose: Separate memory package with embeddings and semantic recall
- Contains: Memory class, message embedding, semantic search integration
- Depends on: Vector stores, Storage (for persistence)
- Used by: Core agent/workflow execution for conversation context

**`packages/server/`:**
- Purpose: HTTP server for exposing agents and workflows as endpoints
- Contains: Server route registration, request/response handling
- Uses: Core framework abstractions
- Configuration: Handled by server adapters

**`packages/rag/`:**
- Purpose: Retrieval-augmented generation utilities
- Contains: Document chunking, embedding, retrieval pipelines
- Integrates with: Vector stores, agents

**`packages/evals/`:**
- Purpose: Evaluation framework for scoring and assessing AI outputs
- Contains: Scorer definitions, evaluation runners, tracing
- Used by: Agents and workflows for measuring performance

**`packages/loggers/`:**
- Purpose: Multiple logger implementations (Pino, Console, etc.)
- Contains: Logger classes and interfaces
- Registered with: Mastra config during initialization

**`packages/cli/`:**
- Purpose: Command-line tooling for Mastra projects
- Contains: Project scaffolding, playground server, development commands
- Entry point: `bin/mastra.js` or similar

**`packages/playground/` & `packages/playground-ui/`:**
- Purpose: Web-based IDE for testing agents and workflows
- Contains: Full-stack Next.js application with React components
- Served by: CLI `playground` command

**`stores/`:**
- Purpose: Pluggable storage backend implementations
- Each adapter implements the interface from `packages/core/src/storage/types.ts`
- Supports: Relational (Postgres, MySQL, DuckDB), NoSQL (MongoDB, DynamoDB), Vector (Pinecone, Chroma)
- Usage: Registered via `storage` config in Mastra initialization

**`server-adapters/`:**
- Purpose: Framework-specific HTTP server integrations
- Each adapter bridges between framework routing and Mastra's server base class
- Examples: Express middleware, Hono handlers, Fastify plugins
- Testing: `_test-utils/` contains shared test utilities

**`deployers/`:**
- Purpose: Platform-specific deployment adapters
- Vercel: Environment variable setup, serverless function bundling
- Cloudflare: Workers script generation, D1 binding configuration
- Netlify: Function configuration and edge function support
- Cloud: Mastra Cloud-specific deployment

**`client-sdks/`:**
- Purpose: Client libraries for consuming Mastra from browsers/apps
- `client-js/`: Direct API client with type generation
- `ai-sdk/`: Vercel AI SDK integration (useChat, useObject)
- `react/`: React hooks and UI components for agent/workflow interaction

**`auth/`:**
- Purpose: Authentication provider integrations
- Each directory contains auth handler for specific provider
- Provides: Session management, user context, token handling

**`integrations/`:**
- Purpose: Third-party OpenAPI-based tool integrations
- Examples: Stripe, GitHub, Slack, Google APIs
- Generated from: OpenAPI specs and enhanced with human-written schemas
- Used by: Agents accessing external services

**`observability/`:**
- Purpose: Tracing and monitoring for Mastra applications
- Provides: Span creation, exporters (cloud, local), decorators for telemetry
- Used by: All framework components tracking execution

**`docs/`:**
- Purpose: Documentation site built with Next.js
- Course content in `docs/src/course/`
- API reference generated from code comments
- Deployment: Static export for hosting

## Key File Locations

**Entry Points:**
- `packages/core/src/index.ts` - Main library export (Mastra, Config)
- `packages/cli/src/index.ts` - CLI entry point
- `packages/server/src/index.ts` - Server package entry
- `server-adapters/express/src/index.ts` - Express adapter

**Configuration:**
- `turbo.json` - Monorepo build task configuration
- `pnpm-workspace.yaml` - Workspace packages definition
- `tsconfig.json` - TypeScript compiler options
- `tsconfig.build.json` - Build-specific TS config
- `.prettierrc` - Code formatting configuration
- `.eslintrc` or `eslint.config.js` - Linting rules

**Core Logic:**
- `packages/core/src/mastra/index.ts` - Mastra class (central orchestrator)
- `packages/core/src/agent/agent.ts` - Agent class (autonomy, tool invocation)
- `packages/core/src/workflows/workflow.ts` - Workflow class (step execution)
- `packages/core/src/tools/tool.ts` - Tool abstraction
- `packages/core/src/memory/memory.ts` - Memory implementation
- `packages/core/src/storage/types.ts` - Storage interface definitions
- `packages/core/src/llm/` - LLM routing and model management

**Message & Communication:**
- `packages/core/src/agent/message-list/message-list.ts` - Unified message handling
- `packages/core/src/agent/message-list/adapters/` - Format adapters (Vercel, OpenAI, etc.)
- `packages/core/src/stream/` - Streaming and output formatting

**Testing:**
- Test files co-located with source: `*.test.ts`, `*.spec.ts`
- `packages/core/src/agent/__tests__/` - Agent test suite
- `packages/core/src/workflows/__tests__/` - Workflow test suite
- `stores/_test-utils/` - Storage testing utilities
- `server-adapters/_test-utils/` - Server adapter testing utilities

## Naming Conventions

**Files:**
- `*.ts` - TypeScript source files
- `*.test.ts` - Vitest test files (co-located with source)
- `*.spec.ts` - Alternative test naming (less common)
- `index.ts` - Barrel export files in directories
- `types.ts` - Type definitions for a module
- `constants.ts` - Constant definitions
- `*.types-d.ts` - Type-only tests using `type-level-assertions` pattern

**Directories:**
- Lowercase with hyphens: `message-list`, `tool-builder`, `server-adapters`
- Underscores for prefixed/internal dirs: `_config`, `_external-types`, `_vendored`
- Domain-specific plurals: `stores`, `integrations`, `deployments`

**Classes/Types:**
- PascalCase for class names: `Agent`, `Workflow`, `Mastra`, `MessageList`
- PascalCase for interfaces: `Config`, `WorkflowConfig`, `ProcessorContext`
- camelCase for type aliases: `AgentExecutionOptions`, `ToolAction`

**Functions:**
- camelCase for all functions: `createAgent()`, `createWorkflow()`, `makeCoreTool()`
- `create*` pattern for factories
- `is*` pattern for type guards: `isProcessor()`, `isZodType()`
- `get*` pattern for getters: `getOrCreateSpan()`

**Constants:**
- UPPERCASE_SNAKE_CASE for true constants: `MASTRA_THREAD_ID_KEY`, `PUBSUB_SYMBOL`
- camelCase for config-like constants

## Where to Add New Code

**New Feature:**
- Implementation: `packages/core/src/[feature-name]/` or existing domain
- Tests: Co-locate as `[file].test.ts` in same directory
- Example: Feature for URL parsing → `packages/core/src/utils/url-parser.ts` + `url-parser.test.ts`

**New Component/Module:**
- Standalone module: Create directory in `packages/core/src/[name]/` with `index.ts` barrel export
- Example: New processor type → `packages/core/src/processors/custom-processor.ts`

**New Storage Adapter:**
- Create directory in `stores/[adapter-name]/`
- Implement interface from `packages/core/src/storage/types.ts`
- Use test utilities from `stores/_test-utils/`

**New Server Adapter:**
- Create directory in `server-adapters/[framework-name]/`
- Extend base from `packages/core/src/server/base.ts`
- Use test utilities from `server-adapters/_test-utils/`

**Utilities/Helpers:**
- Shared utilities: `packages/core/src/utils/` (already contains `utils.ts`)
- Format-specific utilities: Within domain directories (e.g., `message-list/utils/`)
- Test utilities: `packages/core/src/test-utils/` for core, `stores/_test-utils/` for storage

**Integration/External API:**
- Location: `integrations/[service-name]/` (follows OpenAPI pattern)
- Or as part of core: `packages/core/src/integration/` for built-in integrations

## Special Directories

**`.planning/`:**
- Purpose: GSD (goals, status, deliverables) planning documents
- Generated: By GSD orchestrator commands
- Committed: Yes, tracked in git for context

**`.changeset/`:**
- Purpose: Changeset entries for release management
- Generated: By `pnpm changeset` during development
- Committed: Yes, organized by pull request/feature

**`.claude/`:**
- Purpose: Claude Code context and instructions
- Contents: `CLAUDE.md` with development guidelines
- Not generated: Manually maintained

**`.cursor/`:**
- Purpose: Cursor IDE configuration and rules
- Contents: `rules/`, `commands/` directories with prompts
- Not generated: Manually maintained

**`explorations/`:**
- Purpose: Experimental features and proof-of-concepts
- Committed: Yes, but separate from main packages
- Example: `longmemeval/` for long-context memory evaluation

**`examples/`:**
- Purpose: Demo applications showing Mastra usage
- Committed: Yes, but see CLAUDE.md scope note
- NOT included in: Default builds (only on explicit request)

## File Structure Patterns

**Core Package Structure (e.g., `packages/core/src/agent/`):**

```
agent/
├── __tests__/              # Test suites (keep separate for complex modules)
│   ├── agent.test.ts
│   ├── agent-network.test.ts
│   └── ...
├── message-list/           # Sub-module with its own structure
│   ├── adapters/
│   ├── cache/
│   ├── utils/
│   ├── index.ts
│   ├── types.ts
│   └── message-list.ts
├── save-queue/             # Another sub-module
├── workflows/              # Nested workflows specific to agent
├── index.ts                # Barrel export
├── types.ts                # Type definitions
├── agent.ts                # Main class
├── agent.types.ts          # Agent-specific types
├── agent-legacy.ts         # Legacy/compatibility code
└── trip-wire.ts            # Utility class
```

**Storage Adapter Pattern (e.g., `stores/pg/`):**

```
pg/
├── src/
│   ├── index.ts
│   ├── client.ts           # DB client initialization
│   ├── migrations/         # Schema migrations
│   └── domains/            # Storage domain implementations
│       ├── agents.ts
│       ├── workflows.ts
│       └── memory.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**Server Adapter Pattern (e.g., `server-adapters/express/`):**

```
express/
├── src/
│   ├── index.ts            # Main export
│   ├── adapter.ts          # Adapter class
│   └── __tests__/
│       └── adapter.test.ts
├── examples/               # Example usage
├── package.json
└── tsconfig.json
```

---

*Structure analysis: 2026-01-26*
