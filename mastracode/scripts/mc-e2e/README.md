# Mastra Code TUI e2e runners

Mastra Code scenarios live in `scripts/mc-e2e/scenarios/` and are shared by the available runners.

## Recommended CI runner

Use the zero-subprocess Vitest runner:

```bash
MC_E2E_VITEST_SCENARIOS=all pnpm --filter ./mastracode run e2e:test:vitest -- --reporter=dot
```

This constructs Mastra Code in-process, injects a `pi-tui` terminal backed by `@xterm/headless`, and runs four static Vitest shard files in one CI job. It does not launch the `mastracode` CLI, `tsx` scenario entrypoints, worker threads, or Mastra Code subprocesses.

Failed runs keep their per-scenario temp directories under `mastracode/.tmp-mc-e2e-vitest/` until cleanup runs; inspect that directory when debugging a failed scenario.

## Legacy subprocess runner

```bash
pnpm --filter ./mastracode run e2e:test
```

This runs the checked-in scenarios through `scripts/mc-e2e.ts` and the older subprocess/PTY path. Keep it available for observe mode and subprocess parity debugging, but it is not the preferred CI path.

## Worker terminal backend

```bash
pnpm --filter ./mastracode run e2e:test -- --backend terminal --jobs 2
```

This experimental path uses the same in-process terminal backend through worker threads. It was useful during the port, but the static Vitest runner is faster, simpler, and the current CI recommendation.

## Focused Vitest runs

Run one or more scenarios through the single-wrapper Vitest config:

```bash
MC_E2E_VITEST_SCENARIOS=startup,automated-chat pnpm --filter ./mastracode exec vitest run --config scripts/mc-e2e/vitest.config.ts --reporter=dot
```

Use focused runs for scenario development, then run `e2e:test:vitest` with `MC_E2E_VITEST_SCENARIOS=all` before shipping runner changes.
