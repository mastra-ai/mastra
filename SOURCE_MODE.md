# Source mode

Source mode is an additive dev/test path for Mastra workspace packages. It lets package imports resolve through `package.json` exports directly to checked-in `src/**/*.ts` files by enabling the custom `mastra-source` condition.

Source mode does **not** replace package builds, release builds, CJS artifact validation, declaration generation, or package-output checks. It is an opt-in fast feedback lane for local development and explicit source-mode tests.

## Local commands

Validate that all eligible package exports have source entries:

```sh
pnpm source-exports:check
```

Synchronize source export entries after adding or changing package exports:

```sh
pnpm source-exports:sync
```

Opt regular local dev/test commands into source mode from your shell:

```sh
export MASTRA_REPO_RUN_FROM_SOURCE=true
```

With that environment variable set, package-local Vitest commands such as `pnpm test:core` and package-local `pnpm test` runs resolve Mastra workspace packages from source instead of requiring `dist/` artifacts. Root `pnpm test` switches to the curated source-safe local lane described below; external-service/API-key/known-infra lanes remain explicit. The repo-local `mastra` binary also treats `mastra dev` as source-mode only when it can prove it is running from a linked Mastra repo checkout.

For linked local projects, export the env var in the shell that runs the linked CLI, then run `mastra dev` normally:

```sh
export MASTRA_REPO_RUN_FROM_SOURCE=true
mastra dev
```

The CLI only honors `MASTRA_REPO_RUN_FROM_SOURCE=true` for `mastra dev` when the installed `mastra` package has linked-repo source files available (`packages/cli/src/index.ts`, the workspace root `pnpm-workspace.yaml`, and `packages/core/src`). Published package installs do not include that shape, so the env var is a no-op for regular users. When the guard passes, the CLI forwards `MASTRA_SOURCE_MODE=1`, `MASTRA_REPO_RUN_FROM_SOURCE=true`, `MASTRA_SOURCE_MODE_WORKSPACE_ROOT`, and `NODE_OPTIONS=--conditions=mastra-source` to the dev server process so linked workspace packages resolve through `mastra-source` exports.

When full Studio assets are unavailable because `packages/playground/dist` has not been built, source-mode `mastra dev` still starts the API server and writes a minimal fallback Studio page. Build playground first if you need the full Studio UI during a no-build linked-project run; the fallback contract only proves the API/dev server path.

Build scripts stay artifact-focused in source mode. `pnpm build:*` commands continue to run the normal Turbo build path and produce package artifacts; source mode does not redefine build scripts as no-build checks. If you want a no-build correctness check while working from source, run the relevant package or root `typecheck` script explicitly.

Run the source-safe local project groups explicitly from source without a prebuild:

```sh
pnpm test:source-mode
```

`pnpm test:source-mode` invokes `scripts/run-source-mode-tests.mjs`, which sets `MASTRA_SOURCE_MODE=1` and `NODE_OPTIONS="--conditions=mastra-source"`, then runs the curated source-safe project groups sequentially. This is the same lane root `pnpm test` uses when `MASTRA_REPO_RUN_FROM_SOURCE=true` is set. Splitting the groups avoids Vite/Vitest project-initialization recursion while preserving the no-build contract. It intentionally does not attempt every API-key, external-service, Docker-only, or known-infra-sensitive suite in the repository.

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

Root `vitest.config.ts` centralizes source-mode config. When `MASTRA_REPO_RUN_FROM_SOURCE=true` or `MASTRA_SOURCE_MODE=1`, it enables:

- resolver conditions: `mastra-source`, `node`
- SSR external conditions matching source mode
- workspace dependency inlining for `@mastra/*`, `@internal/*`, and `mastra`
- repo-root-relative aliases for internal test setup files
- a source-mode test exclusion list for artifact-only/CJS import probes and existing local-environment-sensitive tests that are still covered by the artifact lane

Every Vitest config is expected to use `withSourceModeConfig()` unless it is intentionally allowlisted. Run the coverage audit after adding or moving tests:

```sh
pnpm source-mode:check
```

This keeps package imports flowing through `exports` conditions instead of a broad alias map, while still letting Vitest/Vite transform workspace TypeScript source.

## CI topology

CI tests use the normal built-package path by default. This keeps source mode additive while local users and maintainers opt in with `MASTRA_REPO_RUN_FROM_SOURCE=true` or `MASTRA_SOURCE_MODE=1`.

The PR topology keeps the artifact lane as the required package-output proof:

- `.github/workflows/prebuild.yml` `prebuild` job (`Build artifact check`): Runs the full turbo build to validate package artifacts.
- `e2e-tests/pkg-outputs`: Validates real `dist` output.

Source-mode checks remain available through explicit scripts such as `pnpm test:source-mode`, `pnpm test:integration:source-mode`, and `pnpm source-exports:check`.

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
