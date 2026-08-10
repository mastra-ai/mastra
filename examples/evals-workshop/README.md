# Mastra Evals Workshop

A teaching repo for the Mastra evals ecosystem. Two surfaces over one shared
core, so the same scorer you watch print a number in a terminal is the one you
then find in the Studio dashboard.

```
shared/     the agent, the scorers, the dataset   ← the teaching material
headless/   7 runnable exercises, CI-safe         ← terminal
studio/     persistent DB + seeded dashboard      ← browser
```

## Setup

```bash
pnpm install
cp .env.example .env     # optional — only exercise 2b/2c and the LLM judge need it
```

One `.env` at the workshop root serves both surfaces: `studio/.env` is a
symlink to it, and the headless scripts load it via `--env-file-if-exists`.

Exercises 1 and 3–7 run with **no API key**. The agent uses a deterministic mock
model, so every score in this README is reproducible byte-for-byte. With a key
present, the Studio agent switches to `openai/gpt-5-mini` and the LLM-judge
scorer attaches itself.

## The arc

Run them in order; each builds on the last.

| # | Command | Teaches | Key? |
|---|---------|---------|------|
| 1 | `pnpm ex:1` | Writing a scorer: `preprocess → analyze → generateScore → generateReason` | no |
| 2 | `pnpm ex:2` | The 23 prebuilt scorers; code vs LLM judge; RAG context | 2b/2c |
| 3 | `pnpm ex:3` | Gates, thresholds, verdicts — making CI fail | no |
| 4 | `pnpm ex:4` | Multi-turn: `inputs` vs `turns`, and thread ownership | no |
| 5 | `pnpm ex:5` | Workflow targets: overall / per-step / trajectory scoring | no |
| 6 | `pnpm ex:6` | Datasets and experiments — the durable version | no |
| 7 | `pnpm ex:7` | Evaluating an agent that has memory | no |

`pnpm ex:offline` runs everything that needs no key. `pnpm ex:all` runs all seven.

Then the browser half:

```bash
pnpm seed     # creates a dataset + 3 experiments telling a regression story
pnpm dev      # API and Studio UI, both on http://localhost:4111
```

Open **http://localhost:4111 → Evaluation → Datasets → nimbus-support-qa**. Three
experiments: baseline `0.875`, regression `0.375`, fix `0.875`. Noticing a
regression you did not intend is the entire argument for evals — that shape is
the lesson.

Those numbers are byte-identical on every machine: `pnpm seed` deliberately
does *not* load `.env`, so the seeded history runs on the mock model. The dev
server does load it, so live chat uses the real one. Reproducible history,
real traffic, one dashboard.

Chat with the agent under **Agents** too. With a key, `answer-relevancy` and
`toxicity` score every reply as it arrives and appear under
**Evaluation → Overview**.

Storage is split: `eval.db` (LibSQL) holds datasets, experiments and memory;
`observability.duckdb` holds traces and live scores. See the gotcha below for
why that split is not optional.

## Things worth stopping on

Each has a comment block in the file that raises it.

**A missed threshold does not fail the run.** Only gates produce
`verdict: 'failed'`; a threshold miss yields `'scored'`. CI written as
`if (verdict === 'failed') exit(1)` merges straight through a quality
regression. Exercise 3 shows the correct check.

**`runEvals` owns the thread on the multi-turn path.** With a single `input`,
your `memory.thread` passes through untouched. With `inputs`/`turns`, runEvals
generates one per item and overrides yours. So per-item isolation is
`inputs: [question]` — no manual loop. Exercise 4.

**Scorers must be registered on the `Mastra` instance to persist.** Skip it and
runs still print scores, but every save logs
`MASTRA_GET_SCORER_BY_ID_NOT_FOUND` and the dashboard stays empty — a terminal
that looks fine and a dashboard that looks broken. See `shared/src/agent.ts`.

**Agent output is not a string.** `runEvals` hands scorers
`MastraDBMessage[]`, whose `content` is an object, not text. A scorer that only
handles strings silently scores 0 on every row. See `extractText` in
`shared/src/scorers/answer-accuracy.ts`.

**`mastra dev` does not run from the project root.** Its cwd is
`src/mastra/public`, while your scripts run from the project root — so a
relative `file:./x.db` gives them two different databases. `studio/src/mastra/db-path.ts`
resolves an absolute path instead.

**Experiments take `targetType` + `targetId`, not an object.** Passing
`target: agent` fails with *"No task: provide targetType+targetId or task"*.
Exercise 6.

**Code scorers are ~660× faster than judges.** Measured, not estimated:
exercise 2 runs 4 items × 3 code scorers in **124 ms**, then 4 items × 2 LLM
judges in **82,311 ms**. Nothing argues for the code/judge split better than
watching those two numbers print back to back.

**A judge can only grade what you show it.** `support-rubric` sees
`groundTruth` and nothing else, so it marks *true* extra detail as invented —
0.667 on an answer that is entirely correct. Design bug, not model failure;
the comment in `shared/src/scorers/support-rubric.ts` lays out the two fixes.

**LibSQL cannot serve the Evaluation dashboard.** Studio's Overview and
Scorers views call the generic `listScores()`; LibSQL implements only the
scoped variants, so those pages return
`500 — "This storage provider does not support listing scores"`. Only
**clickhouse, convex, duckdb, oracledb, pg** implement it. That is why
`studio/` runs a `MastraCompositeStore`: LibSQL for everything, DuckDB for the
observability domain alone.

**Live scoring needs an `Observability` config, or it silently does nothing.**
Scores from agent-attached scorers hang off trace spans. Without
`observability: new Observability({ … exporters: [new MastraStorageExporter()] })`
there are no spans, so no scores are written — and nothing errors. Traces
totalled 0 and the dashboard sat empty while the scorers were genuinely
running.

**Only reference-free scorers belong on live traffic.** Real requests have no
`groundTruth`, so a scorer that compares against one returns 0 on *every*
request forever — a healthy agent rendered as a flatline of failures. `studio/`
attaches `answer-relevancy` and `toxicity` for live scoring and keeps
`answer-accuracy` for datasets and experiments, where labels exist.

**A real model has no knowledge; the mock does.** The mock answers from
`NIMBUS_KNOWLEDGE`, so it looks omniscient. Swap in a real model and it
correctly says *"I don't have the Nimbus documentation"* — live relevancy was
0.0–0.65 until the facts were inlined into the agent's instructions, then
0.77–1.0. A production agent would retrieve them.

## What is covered

- Custom scorers, all four steps, as plain functions and as an LLM judge
- Prebuilt scorers: 8 code (deterministic) + 15 LLM judge, including the RAG set
- Gates, thresholds (`number` or `{min, max}`), verdicts, CI exit codes
- Multi-turn: holistic vs per-turn assertions
- Workflow targets: overall, per-step by id, trajectory
- Datasets, items with metadata, experiments, both execution paths
- Live sampled scoring on real traffic
- Memory-enabled agents, thread isolation strategies

Not covered here, worth a mention in class: `scoreTraces` (scoring historical
traces after the fact), tool-call mocking for deterministic tool-agent evals,
and the CLI helpers `mastra scorers add|list` and `mastra experiment build`.
