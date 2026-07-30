Web UI (Vite against the web host API): `pnpm --filter ./mastracode/factory-ui web`
Build: `pnpm --filter ./mastracode/factory-ui build`
Typecheck: `pnpm --filter ./mastracode/factory-ui typecheck`
Unit tests: `pnpm --filter ./mastracode/factory-ui test:unit`
MSW UI tests: `pnpm --filter ./mastracode/factory-ui test:msw`

This package owns the MastraCode React SPA, client data layer, Vite config, and UI tests. Its build is bundled into the Mastra CLI, not used by the web host at runtime. For split UI/API development, run `pnpm --dir mastracode/web api`, then `pnpm --dir mastracode/factory-ui web`; Vite runs on :5173 and proxies to :4111.

Build workspace dependencies with `pnpm turbo build --filter ./mastracode/factory-ui`.

Primary tests use Vitest, MSW, real `@mastra/client-js`, and React Query. Mock only the network boundary—never our hooks, services, or auth gating. Unit tests run from `vitest.config.ts`; MSW UI tests use `e2e/ui/vitest.config.ts`, `e2e/ui/msw-server.ts`, and `e2e/ui/render.tsx`. Use `waitForMutationsIdle` for query chains.

Keep the `src`/`src/ui` layout: it avoids churn across 200+ reciprocal imports. `src/ui/tsconfig.json` includes type-resolution workarounds for Playground UI declarations.
