# Evals With Memory — against local monorepo packages

> A self-contained workspace nested inside the
> [main example](../README.md). It resolves `@mastra/*` through `link:`
> overrides into the monorepo, so it exercises your local `dist/` rather than
> the published versions the parent pins. Install and run it separately.

Three concrete, working ways to run **Mastra evals** against an agent that
has **memory** turned on — including observational-memory in `thread` scope
(the configuration that triggers `ObservationalMemory (scope: 'thread')
requires a threadId, but none was found in RequestContext or MessageList.`).

Everything in this example uses Mastra evals primitives (`runEvals`,
`createScorer`, `Dataset.startExperiment`). No custom evaluation harness.

The agent in every script uses `@mastra/memory` + `@mastra/libsql` for
storage and observational memory in `thread` scope. Each script writes to a
fresh temp DB and cleans up after itself. A deterministic mock model is used
so no API key is required and runs are reproducible in CI.

## Run

```bash
pnpm install
pnpm ex:all
```

No `.env` and no API keys — see [Environment](#environment) below.

This example is self-contained: it has its own `pnpm-workspace.yaml` and is
not part of the root workspace, so a plain `pnpm install` here installs only
this example. Do **not** pass `--ignore-workspace` — that skips the local
`pnpm-workspace.yaml`, which is where the `tsx` catalog entry lives, and the
install fails with `ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC`.

The `@mastra/*` deps are `link:` overrides pointing at the monorepo, so the
scripts run against each package's built `dist/`. If you change core, evals,
memory, or libsql while working here, rebuild that package for the change to
take effect:

```bash
pnpm --filter @mastra/evals build   # from the monorepo root
```

## Environment

**None required.** There is no `.env` file and no `process.env` read anywhere
in `src/`:

- **No model API key.** The agent and the observational-memory observation
  model both use the deterministic `createEchoModel()` mock in `src/shared.ts`.
- **No database credentials.** `LibSQLStore` points at a `file:` URL inside a
  fresh `mkdtemp` directory per script, removed on exit.

If you swap the mock for a real model (e.g. `model: 'openai/gpt-5.5'`), you
will then need that provider's key in the environment — but runs stop being
deterministic, so the fixed `groundTruth` assertions in these scripts will
need revisiting.

## The three approaches

### 1. `runEvals` with global `targetOptions.memory`

Script: `src/runeval-global.ts`

Simplest. Pass `targetOptions: { memory: { thread, resource } }` once and
every data item runs against that thread. Use when you want a single
multi-turn conversation across items (e.g. testing recall over a chat).

```ts
await runEvals({
  target: agent,
  scorers: [scorer],
  targetOptions: { memory: { thread: 'eval-thread', resource: 'ci-user' } },
  data: [...]
});
```

Verified: all items land in one thread, scorer runs cleanly, no
`threadId required` errors.

### 2. Per-item threads

Script: `src/runeval-per-item.ts`

> **Outdated — `runEvals` does this for you now.** The script still loops,
> calling `runEvals` once per item and aggregating by hand. That is no longer
> necessary: switching `input: x` to `inputs: [x]` puts the item on the
> multi-turn path, where runEvals generates a thread per item and overrides
> any thread you passed (`runAgentTurns` in
> `packages/core/src/evals/run/index.ts`). Verified: three data items produce
> three isolated threads from a single call.

The supported shape:

```ts
await runEvals({
  target: agent,
  scorers: [scorer],
  targetOptions: { memory: { resource: 'ci-user' } }, // no thread — runEvals owns it
  data: items.map(it => ({ inputs: [it.input], groundTruth: it.groundTruth })),
});
```

The rule, which inverts between the two paths:

- single `input` → your `memory.thread` is passed through untouched
- `inputs` / `turns` → runEvals generates one per item and overrides yours;
  `resource` defaults to the generated thread id

The manual loop in the script is kept as a contrast, not as a recommendation.

### 3. `dataset.startExperiment` with inline task

Script: `src/dataset.ts`

The dataset / experiment runner (`runExperiment` under the hood) does
**not** pass any `memory` option to `agent.generate()` — only
`requestContext`. So the registry path can't drive memory either.

(Note the registry path is `targetType: 'agent'` + `targetId: '<id>'`, a
type/id pair — not an object reference. Passing `target: agent` fails with
*"No task: provide targetType+targetId or task"*.)

Workaround that stays inside Mastra primitives: use an **inline `task`**
function, stash the per-item `{ threadId, resourceId }` in the dataset
item's `metadata`, and call `agent.generate(input, { memory: {...} })`
yourself. The scorer still runs through the dataset/experiment pipeline.

```ts
await dataset.addItems({
  items: items.map(it => ({
    input: it.input,
    groundTruth: it.groundTruth,
    metadata: { threadId: it.thread, resourceId },
  })),
});
await dataset.startExperiment({
  scorers: [scorer],
  task: async ({ input, metadata }) => {
    const { threadId, resourceId } = metadata as any;
    const r = await agent.generate(input, {
      memory: { thread: threadId, resource: resourceId },
    });
    return r.text;
  },
});
```

## Notes / gotchas

- **Thread scope requires the thread to exist before observational memory
  reads it.** Each example pre-creates threads with
  `memory.createThread(...)`.
- `runEvals.targetOptions` is **global per call** — but you rarely need a
  per-item override for threads, because `inputs`/`turns` already isolate
  per item (see approach 2).
- Pre-setting `RequestContext.MastraMemory` (the trick used inside
  workflow-tool isolation and processor tests) does **not** by itself give
  the agent a thread — it's an internal contract populated by
  `prepare-memory-step` after a thread is resolved.
- `Dataset.startExperiment` does not forward memory on the registry path.
  Use the inline `task` workaround above, or call `runEvals` and skip the
  dataset entirely.
- The scorers in these examples are registered on the `Mastra` instance
  (`scorers: { contains }`) so persistence doesn't log
  `MASTRA_GET_SCORER_BY_ID_NOT_FOUND` warnings.

## Gaps worth filing

- `ExperimentConfig` / `StartExperimentConfig` should accept a
  `targetOptions` field that mirrors `runEvals.targetOptions`, so dataset
  users can pass `{ memory: { thread, resource } }` without dropping to an
  inline task.

~~`runEvals` could accept per-item `targetOptions` so per-item threads don't
require a manual loop.~~ **Closed** — `inputs`/`turns` give each data item its
own thread. See approach 2.

## Why this lives in a subfolder

The parent directory (`examples/evals-with-memory/`) covers the rest of the
eval surface — custom and prebuilt scorers, gates and thresholds, workflow and
per-step scoring, datasets, and a seeded Studio dashboard. Exercise 7 there is
the memory story told against **published** packages.

These scripts stay in their own workspace because they do the opposite: the
`pnpm.overrides` in `package.json` point `@mastra/core`, `evals`, `libsql` and
`memory` at `link:../../../packages/*` in the monorepo, so they run against
your local `dist/` and catch a regression before it ships. The parent pins
published versions instead, so a workshop attendee can install from a fresh
clone without building anything.

Two opposite dependency strategies cannot share one `package.json`, which is
the whole reason for the nesting. Install and run them independently:

```bash
cd examples/evals-with-memory/local-packages
pnpm install
pnpm ex:all
```
