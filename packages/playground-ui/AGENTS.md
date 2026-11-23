Build from root: `pnpm build:playground-ui`. Test: `pnpm --filter ./packages/playground-ui test`.
Typecheck: `pnpm --filter ./packages/playground-ui typecheck` (standalone `tsc`; CI runs turbo `typecheck`).
`build` is `vite build`; a vite.config.ts plugin runs TS 7 `tsc` (`tsconfig.build.json`) to emit
declarations and fails on type errors. The package builds in ~5s; a slow build is turbo rebuilding upstream deps.

Domain components (`src/domains`) MUST be compound components, with props where they make sense.
They MUST NOT fetch data: each part receives its data from above (a filter list gets `filters`, even
if fetched from the backend) and exposes callbacks (`onCreate`, `onEdit`, …) for actions. Export data
hooks separately; the call site calls the hook and passes data down. Goal: move to MCP server apps.

PRIMARY tests: Vitest + MSW + typed @mastra/client-js fixtures (`playground-msw-tests` skill), ABOVE
Playwright. Drive the real client + React Query stack; only mock the network; never `vi.mock` our
own data hooks, services, or auth gating. Fixtures live in nearby `__tests__/fixtures/`, typed with
@mastra/client-js response types. Playwright E2E (`e2e-tests-studio`) only when MSW can't model it.

Hand off UI changes with mobile/tablet/desktop screenshots. Keep DS consistency and existing APIs.
Typography: DS tokens only (`Txt` variants, `text-ui-*` / `text-header-*`); no `text-xs/sm/…` or
arbitrary `text-[Npx]` (lint-enforced). No new `asChild`; prefer Base UI's `render` prop.
