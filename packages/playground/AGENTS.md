Build from root: pnpm --filter ./packages/playground build
Unit test from root: pnpm --filter ./packages/playground test
E2E from root: pnpm --filter ./packages/playground test:e2e
If E2E setup is needed first, run pnpm --filter ./packages/playground test:e2e:setup
Typecheck: pnpm --filter ./packages/playground typecheck

Required skills (NON-OPTIONAL — activate before you touch code or tests):

- You MUST activate the `react-best-practices` skill before writing or
  modifying ANY React code (components, hooks, pages, routes, data-fetching,
  redirect/gating logic) in this package. This is non-optional.
- You MUST activate the `playground-msw-tests` skill before adding or
  modifying any tests in this package. This is non-optional.

PRIMARY testing strategy: Vitest + MSW + typed @mastra/client-js fixtures.
This is the #1 way to validate changes here — ABOVE Playwright E2E.
Use the `playground-msw-tests` skill whenever you add or modify hooks, pages,
routes, data-fetching, redirect/gating logic, or any React Query interactions.

Test-first is mandatory (TDD — red → green → refactor):

1. RED: Write a failing MSW-driven test that describes the desired behavior
   before writing or changing implementation code.
2. GREEN: Implement the minimum code needed to make that test pass.
3. REFACTOR: Clean up under the `react-best-practices` guidelines while keeping
   the tests green.

The MSW + typed @mastra/client-js fixture strategy is the REQUIRED test vehicle
for this loop. Do NOT `vi.mock` our own hooks, services, or auth gating to make
a test pass — drive the real stack and mock only the network.

Tests MUST be written BDD-style (the structure defined in the
`playground-msw-tests` skill and codified by the `testing-bdd-no-mocks` rule in
`react-best-practices`):

- Outer `describe` names the unit under test (the hook, component, or function).
- Inner `describe('when …')` names ONE precondition (input shape, RBAC
  capability, feature flag, or loading/error/empty/success state), set up with a
  real MSW fixture — never a mocked hook.
- Each `it('…')` asserts exactly ONE outcome; split multi-assert cases so a
  failure names the exact broken outcome.

This BDD structure and the no-mock rule are lint-enforced via
`no-restricted-syntax` in `packages/playground/eslint.config.js`; unhandled
requests also fail tests because MSW runs with `onUnhandledRequest: 'error'`.

Rules for MSW tests in this package:

- Drive the real @mastra/client-js + React Query stack; only mock the network.
- NEVER mock our own data hooks, services, or auth gating with vi.mock.
- Fixtures live in a nearby `__tests__/fixtures/` folder and MUST be typed
  with response types re-exported from @mastra/client-js. No bespoke inline
  types, no `as any`, no `as unknown as`.
- MSW lifecycle is already wired in `vitest.setup.ts` with
  `onUnhandledRequest: 'error'`. Unhandled requests fail tests on purpose.

Use Playwright E2E (`e2e-tests-studio` skill) only when MSW cannot model the
journey — multi-page navigation, real Mastra server, streaming, or genuine
browser concerns (focus, drag-drop, viewport, real network).

Coordinate with packages/playground-ui when a change crosses app and
component-library boundaries.
