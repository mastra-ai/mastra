Build from root: pnpm --filter ./packages/playground build
Unit test from root: pnpm --filter ./packages/playground test
E2E from root: pnpm --filter ./packages/playground test:e2e
If E2E setup is needed first, run pnpm --filter ./packages/playground test:e2e:setup
Typecheck: pnpm --filter ./packages/playground typecheck

Required skills (NON-OPTIONAL — activate before you touch code or tests):

- `react-best-practices` before writing or modifying ANY React code
  (components, hooks, pages, routes, data-fetching, redirect/gating logic).
- `playground-msw-tests` before adding or modifying any tests.

Vitest + MSW + typed @mastra/client-js fixtures is the primary test strategy,
above Playwright E2E.

Test-first is mandatory (TDD — red → green → refactor):

1. RED: write a failing MSW-driven test for the desired behavior first.
2. GREEN: implement the minimum code to make it pass.
3. REFACTOR: clean up under `react-best-practices` while tests stay green.

The MSW + typed @mastra/client-js fixture stack is the required vehicle: drive
the real stack and mock only the network — never `vi.mock` our own hooks,
services, or auth gating.

Tests MUST be BDD-style (defined in `playground-msw-tests`, codified by the
`testing-bdd-no-mocks` rule in `react-best-practices`):

- Outer `describe` names the unit (hook, component, or function).
- Inner `describe('when …')` names ONE precondition (input shape, RBAC
  capability, feature flag, or loading/error/empty/success state) set up with a
  real MSW fixture — never a mocked hook.
- Each `it('…')` asserts exactly ONE outcome.

This structure and the no-mock rule are lint-enforced via `no-restricted-syntax`
in `eslint.config.js`; MSW also runs with `onUnhandledRequest: 'error'`, so
unhandled requests fail tests.

Fixtures live in a nearby `__tests__/fixtures/` folder and MUST be typed with
response types re-exported from @mastra/client-js — no inline types, no `as any`
or `as unknown as`. The MSW lifecycle is already wired in `vitest.setup.ts`.

Use Playwright E2E (`e2e-tests-studio` skill) only when MSW cannot model the
journey — multi-page navigation, real Mastra server, streaming, or genuine
browser concerns (focus, drag-drop, viewport, real network).

Coordinate with packages/playground-ui when a change crosses app and
component-library boundaries.
