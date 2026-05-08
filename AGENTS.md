Unless user explicitly asks do not inspect reference or modify examples
Prefer most specific AGENTS.md for changed area
For work in packages read package local packages/<name>/AGENTS.md first

turborepo pnpm workspace
packages use strict TypeScript
vitest tests are colocated with source

Prefer narrowest build test lint typecheck for packages
when package splits unit integration or E2E coverage run narrowest suite first
From root prefer specific scripts like pnpm build:core or pnpm --filter ./packages/name script
Do not pnpm run setup pnpm build pnpm build:packages or repo wide test runs when package local is enough
Building whole monorepo is slow and should be last resort
some integration tests need pnpm i --ignore-workspace

features and new packages need related docs updates
Follow docs/AGENTS.md and docs/styleguides when editing docs

After code changes follow @.mastracode/commands/changeset.md

Architecture
modular agent framework with central orchestration and pluggable components
packages/core/src
mastra/ central config hub dependency injection
agent/ abstraction with tools memory voice
tools/ agent tools
memory/ semantic recall working memory observational memory history persistence
workflows/ step based execution suspend resume
storage/ pluggable db backends with shared interfaces

Read relevant @.claude/commands/
changeset
commit
gh-new-pr
gh-pr-comments
make-moves

Read relevant @.claude/skills/
e2e-tests-studio REQUIRED for packages/playground-ui packages/playground E2E behavior tests
mastra-docs
react-best-practices
tailwind-best-practices
mastra-smoke-test
smoke-test create Mastra project and smoke test studio

## Cursor Cloud specific instructions

### Environment
- Node.js >=22.13.0 and pnpm 10.29.3 are pre-installed via corepack.
- `pnpm install --frozen-lockfile` is the update script; it runs automatically on VM startup.
- Some pnpm build scripts (esbuild, @swc/core, sharp, etc.) may be blocked by pnpm's trust policy. The built binaries for esbuild are still present in the pnpm store and work for builds via tsup/rollup. If a build fails with missing native binaries, run `pnpm rebuild <package>` for the specific package.

### Building
- See `DEVELOPMENT.md` for the full build guide and available `pnpm build:*` / `pnpm test:*` scripts.
- Always prefer targeted builds (`pnpm build:core`, `pnpm build:cli`, etc.) over `pnpm build` which builds the entire monorepo.
- The CLI build (`pnpm build:cli`) includes the playground UI and takes ~90s on first run; subsequent runs use Turborepo cache.

### Running the dev server (Studio)
- The `examples/agent` project requires `OPENAI_API_KEY` at initialization (the `OpenAIVoice()` constructor checks eagerly). Set the env var before running `pnpm mastra:dev` from `examples/agent/`.
- Before running the example agent, install its deps: `cd examples/agent && pnpm install --ignore-workspace`.
- Alternatively, scaffold a minimal project with `create-mastra` (see `.claude/skills/smoke-test/SKILL.md`) which does not require API keys at startup.

### Testing
- Unit tests for core (`pnpm test:core`) run ~8000 tests; ~126 tests fail without `OPENAI_API_KEY` (these are e2e tests requiring real API calls).
- Server tests (`pnpm test:server`) pass fully without API keys (1217 tests).
- Integration tests for stores require Docker and per-package docker-compose files.
- MCP tests (`pnpm test:mcp`) have a known self-import resolution issue in the test harness.
