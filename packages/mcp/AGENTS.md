Build from root: pnpm --filter ./packages/mcp build:lib
Test from root: use the narrowest applicable suite: pnpm --filter ./packages/mcp test:client, pnpm --filter ./packages/mcp test:server, or pnpm --filter ./packages/mcp test:integration

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

This package splits client, server, and integration coverage
Prefer the narrowest suite over running everything

Keep client, server, and shared protocol concerns separate
