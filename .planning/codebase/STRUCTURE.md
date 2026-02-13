# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
mastra/
├── packages/                   # Core framework packages
│   ├── core/                   # Central orchestration, base classes
│   ├── server/                 # HTTP handlers, route definitions
│   ├── cli/                    # CLI commands (dev, build, deploy)
│   ├── deployer/               # Build and deployment logic
│   ├── memory/                 # Conversation memory implementation
│   ├── mcp/                    # Model Context Protocol client/server
│   ├── rag/                    # RAG utilities, document processing
│   ├── evals/                  # Evaluation framework, scorers
│   ├── auth/                   # Auth utilities (JWT, session)
│   ├── loggers/                # Logger implementations
│   ├── playground/             # Admin UI backend
│   ├── playground-ui/          # Admin UI frontend (React)
│   ├── agent-builder/          # Agent configuration builder
│   └── _*/                     # Internal packages (underscore prefix)
├── stores/                     # Storage adapter implementations
│   ├── pg/                     # PostgreSQL storage + pgvector
│   ├── libsql/                 # LibSQL/Turso storage
│   ├── mongodb/                # MongoDB storage
│   ├── pinecone/               # Pinecone vector store
│   ├── chroma/                 # ChromaDB vector store
│   └── .../                    # 20+ additional stores
├── server-adapters/            # HTTP framework adapters
│   ├── hono/                   # Hono adapter (primary)
│   ├── express/                # Express adapter
│   ├── fastify/                # Fastify adapter
│   └── koa/                    # Koa adapter
├── auth/                       # Auth provider integrations
│   ├── workos/                 # WorkOS auth
│   ├── supabase/               # Supabase auth
│   ├── auth0/                  # Auth0 auth
│   ├── firebase/               # Firebase auth
│   └── better-auth/            # Better-auth adapter
├── deployers/                  # Platform deployment adapters
│   ├── vercel/                 # Vercel deployment
│   ├── netlify/                # Netlify deployment
│   ├── cloudflare/             # Cloudflare deployment
│   └── cloud/                  # Mastra cloud deployment
├── voice/                      # Voice/TTS provider integrations
│   ├── openai/                 # OpenAI TTS/STT
│   ├── deepgram/               # Deepgram
│   ├── elevenlabs/             # ElevenLabs
│   └── .../                    # Additional voice providers
├── observability/              # Observability provider integrations
│   ├── mastra/                 # Base observability
│   ├── langfuse/               # Langfuse exporter
│   ├── datadog/                # Datadog exporter
│   └── .../                    # Additional exporters
├── client-sdks/                # Client libraries
│   ├── client-js/              # JavaScript/TypeScript client
│   ├── react/                  # React hooks
│   └── ai-sdk/                 # AI SDK integration
├── workflows/                  # Workflow extensions
├── pubsub/                     # Pub/sub implementations
├── e2e-tests/                  # End-to-end tests
├── docs/                       # Documentation site (Next.js)
├── examples/                   # Example applications
└── scripts/                    # Build/maintenance scripts
```

## Directory Purposes

**`packages/core/`:**

- Purpose: Foundation of framework, exports `Mastra` class
- Contains: Agent, Workflow, Tool, Storage interfaces, Memory base, LLM abstractions
- Key files: `src/mastra/index.ts`, `src/agent/agent.ts`, `src/workflows/workflow.ts`

**`packages/server/`:**

- Purpose: HTTP API definitions and handlers
- Contains: Route handlers for agents, workflows, memory, tools, MCP
- Key files: `src/server/handlers/*.ts`, `src/server/server-adapter/`

**`packages/cli/`:**

- Purpose: Command-line interface
- Contains: `dev`, `build`, `deploy` commands
- Key files: `src/index.ts`, `src/commands/`

**`packages/memory/`:**

- Purpose: Concrete memory implementation with semantic recall
- Contains: `Memory` class, working memory tools
- Key files: `src/index.ts`

**`stores/`:**

- Purpose: Database adapter implementations
- Contains: One package per storage backend
- Key files: `{store}/src/storage.ts`, `{store}/src/vector.ts`

**`server-adapters/`:**

- Purpose: HTTP framework integration
- Contains: Adapter classes extending `MastraServerBase`
- Key files: `{adapter}/src/index.ts`, `{adapter}/src/auth-middleware.ts`

**`auth/`:**

- Purpose: Auth provider integrations
- Contains: Provider-specific auth adapters
- Key files: `{provider}/src/index.ts`

## Key File Locations

**Entry Points:**

- `packages/core/src/index.ts`: Core exports (`Mastra`, `Config`)
- `packages/cli/src/index.ts`: CLI entry point
- `server-adapters/hono/src/index.ts`: Primary server adapter

**Configuration:**

- `tsconfig.json`: Root TypeScript config
- `turbo.json`: Turborepo build configuration
- `pnpm-workspace.yaml`: Workspace package definitions

**Core Logic:**

- `packages/core/src/mastra/index.ts`: `Mastra` class (~1000 lines)
- `packages/core/src/agent/agent.ts`: `Agent` class
- `packages/core/src/workflows/workflow.ts`: `Workflow` class
- `packages/core/src/tools/tool.ts`: `Tool` class
- `packages/core/src/storage/base.ts`: Storage abstractions

**Testing:**

- `packages/*/src/**/*.test.ts`: Co-located unit tests
- `e2e-tests/`: End-to-end test packages

## Naming Conventions

**Files:**

- `kebab-case.ts`: All source files
- `*.test.ts`: Test files co-located with source
- `index.ts`: Package/directory entry points

**Directories:**

- `lowercase`: Package and feature directories
- `_prefix`: Internal packages not for public consumption

**Packages:**

- `@mastra/{name}`: Public packages
- `@internal/{name}`: Internal packages

## Where to Add New Code

**New Agent Feature:**

- Primary code: `packages/core/src/agent/`
- Tests: Co-located `*.test.ts`

**New Storage Adapter:**

- Implementation: `stores/{name}/src/`
- Follow pattern from `stores/pg/` or `stores/libsql/`

**New Server Handler:**

- Handler: `packages/server/src/server/handlers/{name}.ts`
- Register in server adapter routes

**New Auth Provider:**

- Implementation: `auth/{provider}/src/`
- Follow pattern from `auth/workos/`

**New Voice Provider:**

- Implementation: `voice/{provider}/src/`
- Implement `MastraTTS` interface

**Utilities:**

- Shared helpers: `packages/core/src/utils.ts`
- Package-specific: `{package}/src/utils/`

## Special Directories

**`packages/_vendored/`:**

- Purpose: Vendored third-party code
- Generated: No
- Committed: Yes

**`packages/_external-types/`:**

- Purpose: External type definitions for AI SDK versions
- Generated: No
- Committed: Yes

**`dist/`:**

- Purpose: Build output (per package)
- Generated: Yes
- Committed: No

**`.turbo/`:**

- Purpose: Turborepo cache
- Generated: Yes
- Committed: No

---

_Structure analysis: 2026-01-27_
