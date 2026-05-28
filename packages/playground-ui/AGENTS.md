Build from root: pnpm build:playground-ui
Test from root: pnpm --filter ./packages/playground-ui test

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

PRIMARY testing strategy: Vitest + MSW + typed @mastra/client-js fixtures.
This is the #1 way to validate changes here — ABOVE Playwright E2E.
Use the `playground-msw-tests` skill for business hooks, data components,
gating, and React Query flows.

Rules:

- Drive the real @mastra/client-js + React Query stack; only mock the network.
- Never `vi.mock` our own data hooks, services, or auth gating.
- Fixtures live in nearby `__tests__/fixtures/` folders and MUST be typed with
  response types re-exported from @mastra/client-js.

Use Playwright E2E (`e2e-tests-studio` skill) only when MSW cannot model the
journey. Run e2e-frontend-validation for frontend changes before merging when
applicable.

This package needs both component validation and realistic UI validation.
Preserve design-system consistency and existing component APIs where possible.
