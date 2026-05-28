Build from root: pnpm --filter ./packages/playground build
Test from root: pnpm --filter ./packages/playground test:e2e
If setup is needed first, run pnpm --filter ./packages/playground test:e2e:setup

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

This package is primarily validated with E2E coverage
Treat changes here as product-behavior changes

Coordinate with packages/playground-ui when a change crosses app and component-library boundaries
