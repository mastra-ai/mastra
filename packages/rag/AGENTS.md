Build from root: pnpm build:rag
Test from root: pnpm test:rag
Lint from root if needed: pnpm --filter ./packages/rag lint

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

Most validation is package-scoped Vitest coverage
Retrieval changes should use targeted tests for the exact path that changed

Be careful with chunking and query changes because relevance regressions are easy to miss in static checks
