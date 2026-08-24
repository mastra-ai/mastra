Build from root: pnpm build:playground-ui
Test from root: pnpm --filter ./packages/playground-ui test
Typecheck: pnpm --filter ./packages/playground-ui typecheck (standalone `tsc`)

`build` is `vite build` only; vite-plugin-dts emits declarations and gates type
errors via the `afterDiagnostic` hook in vite.config.ts. Use the `typecheck`
script for an explicit `tsc` gate (CI runs turbo `typecheck`). The package's own
build is ~8s; a slow `build:playground-ui` is the cold turbo cache rebuilding
upstream deps (`^build`), not this package.

PRIMARY testing strategy: Vitest + MSW + typed @mastra/client-js fixtures.
This is the #1 way to validate changes here — ABOVE Playwright E2E.
Use the `playground-msw-tests` skill for business hooks, data components,
gating, and React Query flows.

After tests pass, mutation testing is mandatory on exactly the production
`.ts`/`.tsx` files the task changed (none changed = skip):
`pnpm --filter ./packages/playground-ui test:mutate "src/foo.ts,src/bar.tsx"`.
No dirs/globs, no unrelated files, no direct `stryker run`, no
tests/fixtures/generated/config/docs. Strengthen the TDD/BDD tests to kill
survivors (never weaken assertions); report truly equivalent/unreachable ones.

A survivor in a module-level initializer that _throws_ when mutated (e.g. an
`Intl.DateTimeFormat` option) cannot be killed: the import fails, so the suite
reports zero tests instead of a failing one and Stryker sees no kill. Report
those rather than moving the initializer into the function to chase the score.

recharts lays out nothing under jsdom — `ResponsiveContainer` renders an empty
box, so no axis, series, tooltip or click handler inside a chart is reachable
from a rendered component. Logic that only runs through those callbacks belongs
in a sibling module of plain functions (see `flame-graph-data.ts`,
`latency-card-view.utils.ts`), which is both testable and a cleaner split. What
is left inside the chart is configuration, and its survivors are expected.

A test that throws asynchronously still passes under vitest but crashes
Stryker's runner with `Cannot convert object to primitive value`. jsdom ships no
`PointerEvent`, which Base UI's Checkbox constructs on click — stub it in any
test that clicks one. Base UI opens a popover on `fireEvent.click`, but React
turns a `pointerover` into the `onPointerEnter` a component listens for, so fire
that rather than `fireEvent.pointerEnter` (which drops the coordinates).

Base UI's `ScrollArea.Scrollbar` and `Corner` also render nothing under jsdom —
they need real layout to know there is any overflow — so the scrollbars a
ScrollArea asks for, and their own styling, cannot be reached from a rendered
component either.

Rules:

- Drive the real @mastra/client-js + React Query stack; only mock the network.
- Never `vi.mock` our own data hooks, services, or auth gating.
- Fixtures live in nearby `__tests__/fixtures/` folders and MUST be typed with
  response types re-exported from @mastra/client-js.

Use Playwright E2E (`e2e-tests-studio` skill) only when MSW cannot model the
journey. Run e2e-frontend-validation before merging frontend changes when
applicable.

Include mobile, tablet, and desktop screenshots when handing off UI changes.
Preserve design-system consistency and existing component APIs where possible.
No new `asChild`; prefer Base UI's native `render` prop.
