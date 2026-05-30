Build from root: pnpm build:server
Test from root: pnpm test:server
If you change permissions, also run pnpm --filter ./packages/server generate:permissions and pnpm --filter ./packages/server check:permissions
If you add new @mastra/core imports, also run pnpm --filter ./packages/server check:core-imports

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

Most validation is package-scoped tests plus build output
Permission and handler-contract changes need extra verification

Respect the package's subpath exports
