Scripts (root): `pnpm --filter ./packages/playground <script>` — `build`, `test`,
`test:e2e`, `test:e2e:setup`, `typecheck`.

Required skills (NON-OPTIONAL):

- `react-best-practices` before writing/modifying ANY React code.
- `playground-msw-tests` before adding/modifying any tests.

Vitest + MSW + typed @mastra/client-js fixtures is the primary test strategy
(above Playwright). Drive the real stack, mock only the network — never
`vi.mock` our own hooks, services, or auth gating.

Test-first (TDD): RED failing MSW test → GREEN minimum code → REFACTOR.

After the relevant Vitest tests pass, mutation testing is mandatory for every
production `.ts` or `.tsx` file changed by the current task:

- Pass only the exact package-relative files changed by the current task, for
  example `pnpm --filter ./packages/playground test:mutate "src/foo.ts,src/bar.tsx"`.
- Never pass a directory or glob, never include unrelated dirty files, and never
  run `stryker run` directly. The empty default `mutate` list and required CLI
  argument intentionally prevent a package-wide mutation run.
- Do not mutate tests, fixtures, generated files, configuration, or docs. If the
  task changes no production TypeScript file, no mutation run is needed.
- For every surviving mutant, strengthen the existing TDD/BDD tests and rerun
  the same targeted command. Kill as many mutants as reasonably possible
  without weakening assertions or distorting production code; report any truly
  equivalent or unreachable survivors in the handoff.

BDD-style, lint-enforced in `eslint.config.js`; MSW runs with
`onUnhandledRequest: 'error'`:

- Outer `describe` = the unit.
- Inner `describe('when …')` = ONE precondition via a real MSW fixture.
- Each `it` = ONE outcome.

The SAME BDD shape is required for both MSW tests (`src/**`) and Playwright E2E
specs (`e2e/tests/**`). E2E uses `e2e-bdd/test-needs-when-describe`; see the
`e2e-tests-studio` skill.

Fixtures: nearby `__tests__/fixtures/`, typed with @mastra/client-js response
types (no inline types, no `as any`). MSW is wired in `vitest.setup.ts`.

Use Playwright E2E (`e2e-tests-studio`) only when MSW can't model the journey
(multi-page, real server, streaming, real browser concerns).

Always include mobile, tablet, and desktop screenshots when handing off any UI
modification.

Coordinate with packages/playground-ui for cross-boundary changes.
