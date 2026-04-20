Build from root: pnpm build:memory
Test from root: pnpm test:memory
Typecheck from root: pnpm --filter ./packages/memory check
For storage-backed changes, also run pnpm --filter ./packages/memory test:integration

Integration test workflow

packages/memory/integration-tests is a package-local test harness with its own lockfile
Before running tests there, install its local deps from that directory with pnpm install --ignore-workspace
If imports from linked local packages fail during setup (for example @mastra/ai-sdk/ui or store packages), build the referenced package outputs first from the repo root, e.g. pnpm --filter ./client-sdks/ai-sdk build:lib and pnpm --filter ./stores/upstash build:lib
Run focused tests from packages/memory/integration-tests with package-local Vitest commands, for example:
pnpm vitest run src/with-pg-storage.test.ts --reporter=dot --bail 1 -t "splits buffered output into multiple assistant messages instead of one mega-message"

This package has both unit and integration coverage
Integration tests matter for storage-backed memory behavior

Keep memory logic and storage behavior clearly separated
