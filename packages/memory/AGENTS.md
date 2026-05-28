Build from root: pnpm build:memory
Test from root: pnpm test:memory
Typecheck from root: pnpm --filter ./packages/memory check
For storage-backed changes, also run pnpm --filter ./packages/memory test:integration

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

Integration test workflow

packages/memory/integration-tests is a package-local test harness with its own lockfile
Before running tests there, install its local deps from that directory with pnpm install --ignore-workspace
If imports from linked local packages fail during setup (for example @mastra/ai-sdk/ui or store packages), retry with MASTRA_SOURCE_MODE=true before building referenced package outputs from the repo root
Run focused tests from packages/memory/integration-tests with package-local Vitest commands, for example:
pnpm vitest run src/with-pg-storage.test.ts --reporter=dot --bail 1 -t "splits buffered output into multiple assistant messages instead of one mega-message"

This package has both unit and integration coverage
Integration tests matter for storage-backed memory behavior

Keep memory logic and storage behavior clearly separated
