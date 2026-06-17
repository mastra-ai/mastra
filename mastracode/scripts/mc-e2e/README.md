# Mastra Code TUI e2e runner

Mastra Code scenarios live in `scripts/mc-e2e/scenarios/` and run through the zero-subprocess Vitest runner.

## Run all scenarios

```bash
MC_E2E_VITEST_SCENARIOS=all pnpm --filter ./mastracode run e2e:test -- --reporter=dot
```

The runner constructs Mastra Code in-process, injects a `pi-tui` terminal backed by `@xterm/headless`, and runs four static Vitest shard files in one CI job. It does not launch the `mastracode` CLI, `tsx` scenario entrypoints, worker threads, or Mastra Code subprocesses.

Failed runs keep their per-scenario temp directories under `mastracode/.tmp-mc-e2e-vitest/` until cleanup runs; inspect that directory when debugging a failed scenario.

## Focused scenario runs

Run one or more scenarios through the single-wrapper Vitest config:

```bash
MC_E2E_VITEST_SCENARIOS=startup,automated-chat pnpm --filter ./mastracode exec vitest run --config scripts/mc-e2e/vitest.config.ts --reporter=dot
```

List available scenarios:

```bash
pnpm --filter ./mastracode run e2e:list
```

Use focused runs for scenario development, then run `e2e:test` with `MC_E2E_VITEST_SCENARIOS=all` before shipping runner changes.
