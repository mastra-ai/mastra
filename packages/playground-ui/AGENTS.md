Build from root: pnpm build:playground-ui
Test from root: pnpm --filter ./packages/playground-ui test
Run e2e-frontend-validation for frontend changes before merging

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

This package needs both component validation and realistic UI validation

Preserve design-system consistency and existing component APIs where possible
