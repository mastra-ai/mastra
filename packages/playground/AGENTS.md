Scripts (root): `pnpm --filter ./packages/playground <script>` — `build`, `test`,
`test:e2e`, `test:e2e:setup`, `typecheck`.

Required skills (NON-OPTIONAL):

- `react-best-practices` before writing/modifying ANY React code.
- `playground-msw-tests` before adding/modifying any tests.

Vitest + MSW + typed @mastra/client-js fixtures is the primary test strategy
(above Playwright). Drive the real stack, mock only the network — never
`vi.mock` our own hooks, services, or auth gating.

Test-first (TDD): RED failing MSW test → GREEN minimum code → REFACTOR.

After tests pass, mutation testing is mandatory on exactly the production
`.ts`/`.tsx` files the task changed (none changed = skip):
`pnpm --filter ./packages/playground test:mutate "src/foo.ts,src/bar.tsx"`.
No dirs/globs, no unrelated files, no direct `stryker run`, no
tests/fixtures/generated/config/docs. Strengthen the TDD/BDD tests to kill
survivors (never weaken assertions); report truly equivalent/unreachable ones.

BDD-style, lint-enforced in `eslint.config.js`; MSW runs with
`onUnhandledRequest: 'error'`. Outer `describe` = the unit; inner
`describe('when …')` = ONE precondition via a real MSW fixture; each `it` =
ONE outcome. Same shape for MSW tests (`src/**`) and Playwright E2E specs
(`e2e/tests/**`, rule `e2e-bdd/test-needs-when-describe`, `e2e-tests-studio`
skill).

Fixtures: nearby `__tests__/fixtures/`, typed with @mastra/client-js response
types (no inline types, no `as any`). MSW is wired in `vitest.setup.ts`.

Use Playwright E2E (`e2e-tests-studio`) only when MSW can't model the journey
(multi-page, real server, streaming, real browser concerns).

Include mobile, tablet, and desktop screenshots when handing off UI changes.

Coordinate with packages/playground-ui for cross-boundary changes.
