# Experiment worker E2E

This suite validates the published, installed `mastra experiment build` contract from isolated customer projects. It builds standalone artifacts, copies them away from their source projects, launches fresh worker processes, and records protocol, artifact, process, service, and cleanup evidence.

## Local commands

```bash
pnpm install --frozen-lockfile
pnpm test:experiment
pnpm test:full
pnpm test:full:strict
pnpm test:scenario -- minimal-agent
pnpm test:workflow-routing
```

`test:experiment` is the deterministic credential-free experiment gate used on pull requests. `test:full:strict` adds package-manager, workspace, browser, LSP, native dependency, Docker/Postgres, portability, and negative-boundary coverage. `test:scenario` selects one owning scenario, although registry publication and global setup still run.

## Registry modes

By default the suite builds the CLI, publishes snapshot packages to a temporary Verdaccio registry, and cleans it up. CI publishes once and supplies:

- `MASTRA_E2E_REGISTRY_STORAGE`
- `MASTRA_E2E_REGISTRY_CONFIG`
- `MASTRA_E2E_REGISTRY_TAG`
- `MASTRA_E2E_REGISTRY_ARTIFACT_PATH`
- `MASTRA_E2E_REGISTRY_ARTIFACT_DIGEST`
- `MASTRA_E2E_REGISTRY_PORT`
- `MASTRA_EXPERIMENT_E2E_REQUIRE_PUBLISHED_REGISTRY=1`

Published mode verifies required packages and the publisher's canonical registry digest before installing fixtures; copied or downloaded storage that differs is rejected. `MASTRA_EXPERIMENT_E2E_REPORT_DIR` preserves JSON, Markdown, build logs, and NDJSON transcripts outside the temporary run root. PR/full tiers write one JSON and Markdown report per required scenario plus `summary.json`, and fail if a required scenario or assertion is missing, skipped, or failed.

## CI tiers

`.github/workflows/e2e-experiment-worker.yml` runs every Tuesday at 07:00 UTC and supports manual `pr`, `full`, and `gated` tiers plus an optional scenario selector. One immutable registry artifact is shared by full, browser, and gated jobs. Pull requests use the same published-registry contract through `.github/workflows/e2e-tests.yml`, guarded by exact path routing from `prebuild.yml`.

Gated interfaces run separately in the `experiment-worker-e2e-gated` environment. Missing credentials produce `status: skipped` with skip code `GATED_CREDENTIALS_MISSING`; they never block required OSS acceptance. Required PR/full jobs receive no provider credentials.

## Isolation and ownership

Dependency-layout-sensitive fixtures use separate installation roots and never share `node_modules`. Copied artifacts are checked for source-workspace references. Cleanup assertions cover only resources created by the harness: temporary paths, process groups, ports, registries, databases, and containers.

Platform Linux sandbox execution is outside this OSS suite. The Platform owns hosted scheduling and authoritative experiment/score persistence; the worker validates the standalone artifact and protocol boundary without requiring Platform credentials.
