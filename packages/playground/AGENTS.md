Scripts: `pnpm --filter ./packages/playground <script>` — `build`, `test`, `test:e2e`,
`test:e2e:setup`, `typecheck`. NEVER add a changeset for `@internal/playground` (private, bundled into `mastra`).

Required skills: `react-best-practices` for ANY React code; `playground-msw-tests` for any test.

Pages are call sites: call the data hooks exported by playground-ui and pass data plus callbacks
(`onCreate`, `onEdit`, …) into its compound domain components, which never fetch (see its AGENTS.md).

Primary tests: Vitest + MSW + typed @mastra/client-js fixtures, above Playwright. Drive the real
stack, mock only the network; never `vi.mock` our own hooks, services, or auth gating. TDD: RED → GREEN → REFACTOR.

BDD, lint-enforced (`oxlint.config.ts`); MSW uses `onUnhandledRequest: 'error'`. Outer `describe` =
the unit; inner `describe('when …')` = ONE precondition via a real MSW fixture; each `it` = ONE
outcome. Same for Playwright specs (`e2e/tests/**`, rule `e2e-bdd/test-needs-when-describe`).

Fixtures: nearby `__tests__/fixtures/`, typed with @mastra/client-js types (no inline types, no
`as any`). MSW is wired in `vitest.setup.ts`. Exception: `/connect/*` uses `@mastra/playground-ui/domains/connect` types.

Playwright E2E (`e2e-tests-studio`) only when MSW can't model it (multi-page, real server, streaming, real browser).
Hand off UI changes with mobile/tablet/desktop screenshots. Typography: DS tokens only (`Txt`,
`text-ui-*` / `text-header-*`); no `text-xs/sm/…` or `text-[Npx]` (lint-enforced).
Coordinate with packages/playground-ui for cross-boundary changes.
