Dev (Docker services + API on :4111 + Vite on :5173): `pnpm --dir mastracode/web dev:ui`
Build: `pnpm --filter ./mastracode/factory-ui build`
Typecheck: `pnpm --filter ./mastracode/factory-ui typecheck`
Unit tests: `pnpm --filter ./mastracode/factory-ui test:unit`
MSW UI tests: `pnpm --filter ./mastracode/factory-ui test:msw`

This package owns the MastraCode React SPA, client data layer, Vite config, and UI tests. Its build is bundled into the Mastra CLI, not used by the web host at runtime. Dev orchestration lives in `mastracode/web` (a standalone pnpm project outside the workspace): its `dev:ui` script runs `api` (the host on :4111) and `ui` (Vite on :5173, proxying to :4111). Run either alone to restart one side independently.

Build workspace dependencies with `pnpm turbo build --filter ./mastracode/factory-ui`, or `pnpm turbo run dev --filter ./mastracode/factory-ui` to build them and start Vite in one step.

Primary tests use Vitest, MSW, real `@mastra/client-js`, and React Query. Mock only the network boundary—never our hooks, services, or auth gating. Unit tests run from `vitest.config.ts`; MSW UI tests use `e2e/ui/vitest.config.ts`, `e2e/ui/msw-server.ts`, and `e2e/ui/render.tsx`. Use `waitForMutationsIdle` for query chains.

Keep the `src`/`src/ui` layout: it avoids churn across 200+ reciprocal imports. `src/ui/tsconfig.json` includes type-resolution workarounds for Playground UI declarations.
