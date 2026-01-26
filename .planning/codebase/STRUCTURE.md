# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
mastra/
├── packages/                   # Core framework packages
│   ├── core/                   # Main framework (agents, workflows, tools, storage)
│   ├── memory/                 # Memory implementation with semantic recall
│   ├── rag/                    # Retrieval-augmented generation utilities
│   ├── evals/                  # Evaluation framework and scorers
│   ├── mcp/                    # Model Context Protocol support
│   ├── cli/                    # CLI tool (mastra command)
│   ├── deployer/               # Deployment abstraction
│   ├── server/                 # HTTP handlers and schemas
│   ├── playground/             # Development UI (Studio)
│   ├── playground-ui/          # Shared playground components
│   ├── create-mastra/          # Project scaffolding
│   ├── loggers/                # Logger implementations
│   └── _*/                     # Internal packages (types, config, vendored)
├── stores/                     # Storage adapter implementations
│   ├── pg/                     # PostgreSQL adapter
│   ├── libsql/                 # LibSQL/Turso adapter
│   ├── chroma/                 # Chroma vector store
│   ├── pinecone/               # Pinecone vector store
│   ├── qdrant/                 # Qdrant vector store
│   └── ... (20+ more)          # MongoDB, DynamoDB, Elasticsearch, etc.
├── server-adapters/            # HTTP server framework adapters
│   ├── express/                # Express.js adapter
│   ├── hono/                   # Hono adapter
│   ├── fastify/                # Fastify adapter
│   └── koa/                    # Koa adapter
├── deployers/                  # Platform deployment adapters
│   ├── vercel/                 # Vercel deployment
│   ├── netlify/                # Netlify deployment
│   ├── cloudflare/             # Cloudflare Workers deployment
│   └── cloud/                  # Mastra Cloud deployment
├── voice/                      # Voice/speech packages
│   ├── openai/                 # OpenAI TTS/STT
│   ├── elevenlabs/             # ElevenLabs TTS
│   ├── deepgram/               # Deepgram STT
│   └── ... (10+ more)          # Azure, Google, Cloudflare, etc.
├── auth/                       # Authentication provider adapters
│   ├── clerk/                  # Clerk auth
│   ├── supabase/               # Supabase auth
│   ├── auth0/                  # Auth0 auth
│   └── ... (3 more)            # Firebase, Better-Auth, WorkOS
├── observability/              # Observability/tracing integrations
│   ├── langfuse/               # Langfuse integration
│   ├── langsmith/              # LangSmith integration
│   ├── braintrust/             # Braintrust integration
│   └── ... (7 more)            # Datadog, Sentry, Posthog, etc.
├── client-sdks/                # Client libraries
├── docs/                       # Documentation site (Next.js)
├── e2e-tests/                  # End-to-end tests
├── examples/                   # Example projects
├── templates/                  # Project templates for create-mastra
└── scripts/                    # Build and utility scripts
```

## Directory Purposes

**packages/core:**

- Purpose: Main framework implementation
- Contains: Agents, workflows, tools, storage, memory base, LLM routing
- Key files:
  - `src/index.ts` - Main exports
  - `src/mastra/index.ts` - Central orchestrator
  - `src/agent/agent.ts` - Agent implementation
  - `src/workflows/workflow.ts` - Workflow implementation
  - `src/storage/base.ts` - Storage abstraction

**packages/memory:**

- Purpose: Full memory implementation with vector search
- Contains: Memory class, semantic recall, working memory tools
- Key files:
  - `src/index.ts` - Memory class implementation

**packages/server:**

- Purpose: HTTP API handlers and request/response schemas
- Contains: Agent/tool/workflow handlers, validation schemas
- Key files:
  - `src/server/handlers/` - Route handlers
  - `src/server/schemas/` - Zod schemas

**packages/cli:**

- Purpose: Command-line interface
- Contains: Commands for create, init, dev, build, deploy
- Key files:
  - `src/index.ts` - CLI entry point
  - `src/commands/` - Command implementations

**packages/playground:**

- Purpose: Development UI (Mastra Studio)
- Contains: React app for testing agents/workflows
- Key files:
  - `src/` - React application

**stores/:**

- Purpose: Storage backend implementations
- Contains: One package per storage provider
- Key pattern: Each implements MastraCompositeStore with domain stores

**server-adapters/:**

- Purpose: HTTP framework integrations
- Contains: Adapters for Express, Hono, Fastify, Koa
- Key pattern: Each wraps Mastra handlers for specific framework

**deployers/:**

- Purpose: Platform deployment implementations
- Contains: Vercel, Netlify, Cloudflare, Cloud deployers
- Key pattern: Each implements MastraDeployer interface

**voice/:**

- Purpose: Text-to-speech and speech-to-text providers
- Contains: Provider-specific implementations
- Key pattern: Each exports provider class

**auth/:**

- Purpose: Authentication provider integrations
- Contains: Middleware and utilities per provider
- Key pattern: Each provides auth middleware for server adapters

**observability/:**

- Purpose: Tracing and monitoring integrations
- Contains: Exporters and processors per platform
- Key pattern: Each implements observability exporter

## Key File Locations

**Entry Points:**

- `packages/core/src/index.ts`: Core package exports (Mastra, Config)
- `packages/cli/src/index.ts`: CLI entry point
- `packages/server/src/server/handlers.ts`: Server handlers export

**Configuration:**

- `tsconfig.json`: Root TypeScript config
- `turbo.json`: Turborepo build config
- `pnpm-workspace.yaml`: Workspace packages definition
- `package.json`: Root scripts and dependencies

**Core Logic:**

- `packages/core/src/mastra/index.ts`: Mastra class (central orchestrator)
- `packages/core/src/agent/agent.ts`: Agent implementation
- `packages/core/src/workflows/workflow.ts`: Workflow implementation
- `packages/core/src/tools/tool.ts`: Tool abstraction
- `packages/core/src/storage/base.ts`: MastraCompositeStore
- `packages/core/src/memory/memory.ts`: MastraMemory base class

**Testing:**

- `packages/*/src/**/*.test.ts`: Co-located unit tests
- `e2e-tests/`: End-to-end tests
- `*/_test-utils/`: Shared test utilities

## Naming Conventions

**Files:**

- TypeScript source: `kebab-case.ts` (e.g., `message-list.ts`)
- Tests: `*.test.ts` co-located with source
- Types: `types.ts` in each module directory
- Index exports: `index.ts` per directory

**Directories:**

- Packages: `kebab-case` (e.g., `playground-ui`)
- Internal packages: `_prefix` (e.g., `_external-types`)
- Source directories: `src/` in each package
- Module directories: `kebab-case` (e.g., `message-list/`)

**Classes:**

- PascalCase (e.g., `Mastra`, `Agent`, `MastraCompositeStore`)
- Base classes: `Mastra*Base` or `*Base` prefix

**Functions:**

- camelCase (e.g., `createTool`, `createStep`, `createWorkflow`)
- Factory functions: `create*` prefix

**Interfaces/Types:**

- PascalCase (e.g., `Config`, `AgentConfig`, `ToolAction`)
- Type prefix for generics: `T*` (e.g., `TAgents`, `TWorkflows`)

## Where to Add New Code

**New Feature (e.g., new capability):**

- Primary code: `packages/core/src/{feature}/`
- Types: `packages/core/src/{feature}/types.ts`
- Tests: `packages/core/src/{feature}/*.test.ts`
- Exports: Add to `packages/core/src/{feature}/index.ts`

**New Storage Adapter:**

- Implementation: `stores/{provider}/src/index.ts`
- Tests: `stores/{provider}/src/*.test.ts`
- Must implement: `MastraCompositeStore` base class

**New Server Adapter:**

- Implementation: `server-adapters/{framework}/src/index.ts`
- Examples: `server-adapters/{framework}/examples/`
- Must implement: `MastraServerBase` interface

**New Voice Provider:**

- Implementation: `voice/{provider}/src/index.ts`
- Must implement: `MastraTTS` or `MastraSTT` interfaces

**New Auth Provider:**

- Implementation: `auth/{provider}/src/index.ts`
- Must export: Auth middleware for server adapters

**New Observability Integration:**

- Implementation: `observability/{platform}/src/index.ts`
- Must implement: Observability exporter interface

**New Tool:**

- If framework tool: `packages/core/src/tools/`
- If package-specific: Tool package under `packages/`
- Use `createTool()` factory function

**New Workflow Step:**

- Use `createStep()` factory function
- Can wrap: StepParams, Agent, Tool, or Processor

**Utilities:**

- Shared utilities: `packages/core/src/utils.ts`
- Package-specific: `packages/{package}/src/utils.ts`

## Special Directories

**packages/\_external-types:**

- Purpose: External type declarations and vendored types
- Generated: No
- Committed: Yes

**packages/\_vendored:**

- Purpose: Vendored dependencies with patches
- Generated: No
- Committed: Yes

**patches/:**

- Purpose: pnpm patch files for dependencies
- Generated: By `pnpm patch-commit`
- Committed: Yes

**.changeset/:**

- Purpose: Changelog entries for releases
- Generated: By `pnpm changeset`
- Committed: Yes

**dist/ (in each package):**

- Purpose: Built output
- Generated: Yes
- Committed: No (gitignored)

**node_modules/:**

- Purpose: Dependencies
- Generated: Yes
- Committed: No (gitignored)

**.turbo/:**

- Purpose: Turborepo cache
- Generated: Yes
- Committed: No (gitignored)

---

_Structure analysis: 2026-01-26_
