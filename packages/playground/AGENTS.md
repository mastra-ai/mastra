Build from root: pnpm --filter ./packages/playground build
Unit test from root: pnpm --filter ./packages/playground test
E2E from root: pnpm --filter ./packages/playground test:e2e
If E2E setup is needed first, run pnpm --filter ./packages/playground test:e2e:setup
Typecheck: pnpm --filter ./packages/playground typecheck

PRIMARY testing strategy: Vitest + MSW + typed @mastra/client-js fixtures.
This is the #1 way to validate changes here — ABOVE Playwright E2E.
Use the `playground-msw-tests` skill whenever you add or modify hooks, pages,
routes, data-fetching, redirect/gating logic, or any React Query interactions.

- You MUST activate the `playground-msw-tests` skill before adding or
  modifying any tests in this package. This is non-optional.

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
