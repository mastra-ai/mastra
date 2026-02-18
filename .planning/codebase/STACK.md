# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**

- TypeScript ^5.9.3 - All packages, core framework, integrations

**Secondary:**

- JavaScript - Config files, scripts
- JSON - Configuration, package manifests

## Runtime

**Environment:**

- Node.js >=22.13.0 (required by all packages)

**Package Manager:**

- pnpm >=10.18.0 (strict requirement)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Core:**

- Hono ^4.11.3 - HTTP server framework (core API layer)
- React >=19.0.0 - Playground UI
- Zod ^3.25.0 || ^4.0.0 - Schema validation (peer dependency)

**Testing:**

- Vitest 4.0.16 - Test runner (catalog version)
- @vitest/coverage-v8 4.0.12 - Coverage reporting
- @vitest/ui 4.0.12 - Test UI

**Build/Dev:**

- Turbo ^2.5.8 - Monorepo build orchestration
- tsup ^8.5.0 - TypeScript bundler (all packages)
- Vite ^7.3.0 - Playground UI bundler
- Rollup ^4.50.2 - Additional bundling

## Key Dependencies

**AI/LLM Integration:**

- @ai-sdk/provider (v5 & v6) - AI SDK provider abstraction
- @ai-sdk/openai - OpenAI integration
- @ai-sdk/anthropic - Anthropic integration
- @ai-sdk/google - Google AI integration
- @ai-sdk/azure - Azure OpenAI
- @modelcontextprotocol/sdk ^1.17.5 - MCP protocol support

**Database/Storage:**

- pg ^8.16.3 - PostgreSQL client (`stores/pg`)
- @pinecone-database/pinecone ^3.0.3 - Vector search
- @supabase/supabase-js ^2.50.3 - Supabase client

**Authentication:**

- jsonwebtoken ^9.0.2 - JWT handling (`packages/auth`)
- jwks-rsa ^3.2.0 - JWKS verification
- better-auth ^1.4.5 - Self-hosted auth
- @workos-inc/node ^8.0.0 - WorkOS SDK
- jose ^6.1.1 - Auth0 JWT handling

**Observability:**

- langfuse ^3.38.6 - LLM observability
- posthog-node - Analytics

**UI (playground-ui):**

- @assistant-ui/react ^0.11.47 - Chat UI components
- @radix-ui/\* - UI primitives
- @xyflow/react ^12.9.3 - Flow diagrams
- tailwindcss ^3.4.18 - Styling
- zustand ^5.0.9 - State management

**Utilities:**

- dotenv ^17.2.3 - Environment variables
- p-map ^7.0.3 - Async iteration
- p-retry ^7.1.0 - Retry logic
- lru-cache ^11.2.2 - Caching
- js-tiktoken ^1.0.21 - Token counting

## Configuration

**Environment:**

- dotenv for env loading
- Key vars in `turbo.json`: `RAPID_API_KEY`, `ANTHROPIC_API_KEY`

**Build:**

- `turbo.json` - Build orchestration
- `tsconfig.json` - Base TypeScript config (strict mode)
- `tsconfig.build.json` - Build-specific config
- `.prettierrc` - Code formatting

**TypeScript Settings:**

- `strict: true`
- `module: ES2022`
- `target: ES2020`
- `noUncheckedIndexedAccess: true`

## Platform Requirements

**Development:**

- Docker (for integration tests via `.dev/docker-compose.yaml`)
- PostgreSQL 16 with pgvector 0.8.0+
- Qdrant (vector store testing)
- Redis (caching tests)

**Production Deployment:**

- Vercel (`deployers/vercel`)
- Netlify (`deployers/netlify`)
- Cloudflare (`deployers/cloudflare`)
- Cloud (`deployers/cloud`)

## Monorepo Structure

**Workspace Paths:**

- `packages/*` - Core framework packages
- `stores/*` - Storage adapters (23 stores)
- `auth/*` - Auth provider integrations
- `voice/*` - Speech synthesis/recognition
- `deployers/*` - Platform deployers
- `observability/*` - Tracing/monitoring
- `server-adapters/*` - HTTP framework adapters
- `client-sdks/*` - Client libraries

---

_Stack analysis: 2026-01-27_
