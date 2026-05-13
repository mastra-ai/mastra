# Source mode

Source mode is an additive dev/test path for Mastra workspace packages. It lets package imports resolve through `package.json` exports directly to checked-in `src/**/*.ts` files by enabling the custom `mastra-source` condition.

Source mode does **not** replace package builds, release builds, CJS artifact validation, declaration generation, or package-output checks. It is only the fast feedback lane for local dev and CI tests.

## Local commands

Validate that all eligible package exports have source entries:

```sh
pnpm source-exports:check
```

Synchronize source export entries after adding or changing package exports:

```sh
pnpm source-exports:sync
```

Run unit/typecheck Vitest projects from source without a prebuild:

```sh
pnpm test:source-mode
```

`pnpm test:source-mode` invokes `scripts/run-source-mode-tests.mjs`, which sets `MASTRA_SOURCE_MODE=1` and `NODE_OPTIONS="--conditions=mastra-source"`, then runs the source-safe unit/typecheck project groups sequentially. Splitting the groups avoids Vite/Vitest project-initialization recursion while preserving the no-build contract.

Run the no-dist smoke proof for representative packages:

```sh
pnpm source-mode:smoke
```

Run the source-mode integration-test smoke suite across all integration-test fixtures:

```sh
pnpm test:integration:source-mode
```

This covers `packages/agent-builder/integration-tests`, `packages/mcp/integration-tests`, and a no-external-services slice of `packages/memory/integration-tests` without requiring workspace `dist/` artifacts.

Individual fixture commands are also available after installing that fixture's dependencies:

```sh
cd packages/agent-builder/integration-tests
pnpm i --ignore-workspace --no-frozen-lockfile
pnpm test:source-mode

cd packages/mcp/integration-tests
pnpm i --ignore-workspace --no-frozen-lockfile
pnpm test:mcp:source-mode

cd packages/memory/integration-tests
pnpm i --ignore-workspace --no-frozen-lockfile
pnpm test:source-mode
```

Source-mode memory integration tests skip the worker `tsc` precompile step and run `src/worker/generic-memory-worker.ts` directly with `tsx`, so they do not require workspace `dist/` artifacts. Tests that use Postgres or Upstash still require the fixture's Docker services, same as normal integration-test mode.

## How it works

Package manifests keep their normal artifact exports and add a first-class dev-only condition:

```json
{
  "exports": {
    ".": {
      "mastra-source": "./src/index.ts",
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.js"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

The sync script derives source targets from ESM artifact targets:

- `./dist/index.js` -> `./src/index.ts`
- `./dist/foo/index.js` -> `./src/foo/index.ts`
- `./dist/foo.js` -> `./src/foo.ts`

A small override table in `scripts/source-exports.mjs` covers packages whose source layout intentionally differs from their artifact layout, such as `@internal/core/storage`, `@mastra/playground-ui`, and `@mastra/server` handler patterns.

The validation script fails if an eligible export lacks `mastra-source`, points to a missing source file, or is not explicitly documented as generated/build-only.

## Vitest behavior

Root `vitest.config.ts` centralizes source-mode config. When `MASTRA_SOURCE_MODE=1`, it enables:

- resolver conditions: `mastra-source`, `node`
- SSR external conditions matching source mode
- workspace dependency inlining for `@mastra/*`, `@internal/*`, and `mastra`
- a small source-mode test exclusion list for artifact-only/CJS import probes, external-service projects such as Redis, and existing local-environment-sensitive tests that are still covered by the artifact lane

This keeps package imports flowing through `exports` conditions instead of a broad alias map, while still letting Vitest/Vite transform workspace TypeScript source.

## CI topology

CI tests use source mode by default. Test workflows set `MASTRA_SOURCE_MODE=1` and `NODE_OPTIONS="--conditions=mastra-source"` so package imports resolve to checked-in TypeScript source instead of requiring workspace `dist/` artifacts.

The PR topology has two parallelizable lanes after change detection:

1. **Source-mode test lane**
   - `.github/workflows/test-suite.yml` unit/typecheck and E2E shards
   - secret-backed memory, combined-store, workspace, and E2E workflows
   - no package build prerequisite
   - runs `pnpm source-exports:check`

2. **Single artifact build check**
   - `.github/workflows/prebuild.yml` `prebuild` job (`Build artifact check`)
   - runs the full turbo build exactly to validate package artifacts
   - runs `e2e-tests/pkg-outputs` validation against real `dist` output

`pnpm ci:source-mode:check` guards the test workflows and fails if a new build command is added outside the artifact build check.

## Generated/build-only exceptions

Generated or artifact-only paths must be listed in `GENERATED_EXPORT_EXCEPTIONS` in `scripts/source-exports.mjs` with a reason. Do not silently skip them.

Current exceptions:

- `@mastra/core ./network/vNext` — legacy export retained for built artifacts; no checked-in `src/network/vNext` entrypoint exists.
- `@mastra/core ./telemetry/otel-vendor` — vendor bundle export is generated for built artifacts; no checked-in source entrypoint exists.

## CJS

CJS remains artifact-only in source mode. The `mastra-source` condition is intended for ESM/Vitest/dev resolution. Existing `require` exports are preserved and package-output validation continues to check CJS artifacts.

## Adding a package/export

1. Add the normal artifact export first.
2. Run `pnpm source-exports:sync`.
3. Run `pnpm source-exports:check`.
4. If the export has no checked-in source equivalent, add a documented exception with a reason.
5. Do not introduce wildcard exports for packages like `@mastra/core` unless the artifact export already exists; source mode must not create new public subpaths.
