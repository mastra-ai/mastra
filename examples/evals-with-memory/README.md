# Evals With Memory

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
pnpm install --ignore-workspace
pnpm ex:all
```

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

### 2. `runEvals` once per item (per-item threads)

Script: `src/runeval-per-item.ts`

`runEvals` does **not** support per-item agent options today. Pre-seeding
`RequestContext.MastraMemory` on each data item does NOT drive thread
resolution — only `args.memory.thread` does (`resolveThreadIdFromArgs`
in `packages/core/src/agent/utils.ts`).

The supported CI shape is therefore: loop, calling `runEvals` once per item
with its own `targetOptions.memory`, then aggregate scores yourself.

```ts
for (const it of items) {
  const result = await runEvals({
    target: agent,
    scorers: [scorer],
    targetOptions: { memory: { thread: it.thread, resource: 'ci-user' } },
    data: [{ input: it.input, groundTruth: it.groundTruth }],
  });
}
```

### 3. `dataset.startExperiment` with inline task

Script: `src/dataset.ts`

The dataset / experiment runner (`runExperiment` under the hood) does
**not** pass any `memory` option to `agent.generate()` — only
`requestContext`. So the registry-based `target: agent` path can't drive
memory either.

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
- `runEvals.targetOptions` is **global per call**. There's no per-item
  override there today.
- Pre-setting `RequestContext.MastraMemory` (the trick used inside
  workflow-tool isolation and processor tests) does **not** by itself give
  the agent a thread — it's an internal contract populated by
  `prepare-memory-step` after a thread is resolved.
- `Dataset.startExperiment({ target: agent })` does not forward memory.
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
- `runEvals` could accept per-item `targetOptions` (or a `memory` field on
  `RunEvalsDataItem`) so per-item threads don't require a manual loop +
  aggregation.
