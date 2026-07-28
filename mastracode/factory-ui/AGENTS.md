Web UI (Vite HMR against the web host API): pnpm --filter ./mastracode/factory-ui web
Build: pnpm --filter ./mastracode/factory-ui build
Typecheck: pnpm --filter ./mastracode/factory-ui typecheck
Unit tests: pnpm --filter ./mastracode/factory-ui test:unit
MSW UI tests: pnpm --filter ./mastracode/factory-ui test:msw

This package owns the MastraCode browser application: React SPA, client data
layer, Vite config, and UI tests. Its build produces the Factory SPA bundled by
the Mastra CLI; it is not a runtime dependency of the web host. For split UI/API development, run
`pnpm --dir mastracode/web api` first, then `pnpm --dir mastracode/factory-ui web`.
The `web` script reads the host `.env`, runs Vite on :5173, and proxies to the
host API on :4111.

Build upstream workspace deps first (playground-ui, client-js, factory, etc.):
`pnpm turbo build --filter ./mastracode/factory-ui` handles the graph.

PRIMARY testing strategy: Vitest + MSW + real @mastra/client-js + React Query.
Drive the real fetch/SDK transport and the real React Query cache; only the
network boundary is mocked, via MSW. Never `vi.mock` our own hooks, services,
or auth gating.

- Unit tests (`*.test.ts`) run in node environment via `vitest.config.ts`.
- MSW UI tests (`*.msw.test.tsx`) run in jsdom via `e2e/ui/vitest.config.ts`
  with shared handlers in `e2e/ui/msw-server.ts` and render helpers in
  `e2e/ui/render.tsx` (real ThemeProvider + TooltipProvider +
  QueryClientProvider + ApiConfigProvider stack).
- The two suites have disjoint globs — they never cross-pick each other's files.
- Use `waitForMutationsIdle` (double-idle assert) to avoid false passes in
  query chains with brief gaps.

Source layout preserves `src` and `src/ui` so the 200+ reciprocal
imports between hooks, services, and components stay relative. The `src/ui`
tsconfig has paths workarounds for `react` and `class-variance-authority` types
that playground-ui's d.ts files reference from the pnpm store.
