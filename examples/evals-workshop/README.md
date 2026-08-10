# Mastra Evals Workshop

A teaching repo for the Mastra evals ecosystem. Two surfaces over one shared
core, so the same scorer you watch print a number in a terminal is the one you
then find in the Studio dashboard.

```
shared/     the agent, the scorers, the dataset   ← the teaching material
headless/   11 runnable exercises, CI-safe        ← terminal
studio/     persistent DB + seeded dashboard      ← browser
```

The arc is a loop, not a list. Exercises 1–7 teach you to write and run a
scorer. Exercises 8–11 close the loop that makes it a practice:

```
production traffic → dataset → experiment → compare → gate → fix → back to production
        11              10,9        6,7         8       8,3
```

## Setup

```bash
pnpm install
cp .env.example .env     # optional — only exercise 2b/2c and the LLM judge need it
```

One `.env` at the workshop root serves both surfaces: `studio/.env` is a
symlink to it, and the headless scripts load it via `--env-file-if-exists`.

Every exercise except 2 runs with **no API key**. The agent uses a
deterministic mock model, so every score in this README is reproducible
byte-for-byte. With a key present, the Studio agent switches to
`openai/gpt-5-mini`, the LLM-judge scorer attaches itself, and exercise 11
grades with a real judge instead of a code scorer.

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
| 8 | `pnpm ex:8` | `compareExperiments` — regression detection and the real CI gate | no |
| 9 | `pnpm ex:9` | Dataset versioning, item history, and the score that lies | no |
| 10 | `pnpm ex:10` | Tool mocks; recording a real trace and replaying it forever | no |
| 11 | `pnpm ex:11` | Scoring traffic that already happened | no |
| 12 | `pnpm ex:12` | Versioning the prompt, and evaluating the edit | no |

`pnpm ex:offline` runs everything that needs no key. `pnpm ex:all` runs all twelve.

### What the last five are for

**8 — comparing.** Exercises 3 and 8 both fail a build, and the difference
matters. A gate asks *is this output acceptable at all*; `compareExperiments`
asks *is this build worse than the last one*. A release can pass every gate and
still be a clear regression. Thresholds carry a `direction`, because plenty of
things you score are costs — latency, tokens, tool calls — where up is bad.

**9 — versioning.** Manufactures a lie: edit one question the agent kept
failing, and the score jumps 0.875 → 1.000 with the agent untouched. Pinning
the run to the old version reproduces 0.875 exactly and proves the data moved,
not the model.

**10 — tool mocks.** The flagship. An unmocked eval inherits every dependency
the agent touches; this shows the same item passing and then failing because a
row changed in a database. Then mocks pin it, `unmockedToolPolicy: 'deny'`
proves nothing leaked, and finally `collectToolMocks` reads a real trace and
writes the mocks for you — production incident to deterministic regression test
in one step.

**11 — scoring history.** Inverts the usual order: the traffic happened first,
the scorer came second. Write a scorer today, find out how the agent has been
doing on it since March. Nothing is re-run.

**12 — the prompt itself.** Everything above treats the prompt as a constant,
and it is the thing teams change most often and measure least. `@mastra/editor`
turns an edit into a numbered version, and an experiment can be *pinned* to a
version — so "this wording reads better" becomes a number. The edit under test
is one a real support lead would ask for ("stop overwhelming people with
numbers"), and it takes `answer-accuracy` from `0.875` to `0.125`.

The exercise ends on the trap: run the same dataset without `agentVersion` and
it silently evaluates the prompt in the *code*, which by then is neither
version anyone is arguing about. Eval runs that are not pinned are not
measuring what your users are talking to.

## The browser half

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

### Three buttons worth the whole demo

Go to **Observability → Traces**, click any `agent run` row. The panel that
opens has each of the last three exercises as a button:

| Button | The exercise it is |
|---|---|
| **Save as Dataset Item** | closes the loop — see below |
| **Add tool mocks to item** | exercise 10's `collectToolMocks` |
| **Evaluate Trace** → Scoring tab → pick a scorer → **Start Scoring** | exercise 11's `scoreTraces` |

**Save as Dataset Item** is the one to spend time on. It opens pre-filled from
the trace: the real question as `input`, the agent's actual answer as
`groundTruth` (edit it to what it *should* have said), the recorded step
sequence as `expectedTrajectory`, and the tool calls as `toolMocks`. That is
the production→dataset loop in a single dialog, and it answers the question
every eval talk skips: *where do datasets come from?*

The span panel also has a **Feedback** tab — thumbs, ratings, corrections from
humans, stored alongside the machine scores.

### Editing the prompt in the browser

**Agents → Nimbus Support Agent → Editor** is the visual half of exercise 12:
the system prompt on the left, a live chat on the right, and a version picker
at the top. `pnpm seed` snapshots the code prompt as **v1** and publishes it,
so the tab opens on a real baseline rather than "No versions yet".

Edit the prompt — appending *"Avoid overwhelming the customer with specific
numbers."* is the edit exercise 12 measures — then:

| Button | What it actually does |
|---|---|
| **Save New Version** | writes v2. Changes nothing for anyone. |
| **Publish** | points the live agent at v2. This is the one that ships. |

Save and Publish being separate is the part worth saying out loud, because the
editor's own banner blurs it: *"Save your draft to ensure the chat uses your
latest changes"* is not true. Agents resolve at `status: 'published'`, chat
pane included, so a saved-but-unpublished version is inert. Verified here: with
v2 saved and v1 published, the server still serves v1.

Two more boundaries worth knowing before someone asks:

- **Only `instructions` and `tools` are overridable.** `model`, `memory` and
  `scorers` stay code-defined — they hold live objects that cannot survive a
  database row. Handy for evals: the model is pinned, so a score that moves
  between versions moved because of the prompt.
- **`source: 'db'` vs `'code'`.** This project uses `'db'`, where versions live
  in storage and you get Save/Publish. In `'code'` mode Studio swaps those for
  **Download JSON** and **Open PR**, and the editor re-routes its storage to a
  filesystem store — the right choice for a team that reviews prompts in git,
  the wrong one for measuring them.

Chat with the agent under **Agents** too. With a key, `answer-relevancy` and
`toxicity` score every reply as it arrives and appear under
**Evaluation → Overview**.

Storage is split: `eval.db` (LibSQL) holds datasets, experiments, scorer
definitions and memory; `observability.duckdb` holds traces and live scores.
See the gotchas for why that split is not optional.

## Things worth stopping on

Each has a comment block in the file that raises it. Most of these are
**silent** — no error, just wrong numbers — which is the real reason they are
worth a slide.

**A missed threshold does not fail the run.** Only gates produce
`verdict: 'failed'`; a threshold miss yields `'scored'`. CI written as
`if (verdict === 'failed') exit(1)` merges straight through a quality
regression. Exercise 3 shows the correct check, and exercise 8 shows the
better one.

**`runEvals` owns the thread on the multi-turn path.** With a single `input`,
your `memory.thread` passes through untouched. With `inputs`/`turns`, runEvals
generates one per item and overrides yours. So per-item isolation is
`inputs: [question]` — no manual loop. Exercise 4.

**Scorers must be registered on the `Mastra` instance to persist.** Skip it and
runs still print scores, but every save logs
`MASTRA_GET_SCORER_BY_ID_NOT_FOUND` and the dashboard stays empty — a terminal
that looks fine and a dashboard that looks broken. See `shared/src/agent.ts`.

**`getScorerById` resolves `scorer.id`, not the key you registered under.**
The prebuilt scorers name themselves with a suffix — `completeness-scorer`,
`answer-relevancy-scorer`. Register one under a tidier key, ask for that key,
and you get `MASTRA_GET_SCORER_BY_ID_NOT_FOUND` for a scorer that is sitting
right there. Exercise 11.

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

**LibSQL cannot serve the Evaluation dashboard, or store spans.** Studio's
Overview and Scorers views call the generic `listScores()`, which LibSQL does
not implement, so those pages return
`500 — "This storage provider does not support listing scores"`. Its
observability domain also accepts writes but stores no spans, so traces come
back empty. Only **clickhouse, convex, duckdb, oracledb, pg** implement the
score listing. That is why both surfaces run a `MastraCompositeStore`: LibSQL
for everything, DuckDB for the observability domain alone.

**Live scoring needs an `Observability` config, or it silently does nothing.**
Scores from agent-attached scorers hang off trace spans. Without
`observability: new Observability({ … exporters: [new MastraStorageExporter()] })`
there are no spans, so no scores are written — and nothing errors.

**A short-lived script writes zero traces unless you flush.** Spans are
exported in batches. A script that generates traffic and exits takes the
pending batch with it: no traces, no error, and an eval over history that
silently finds nothing to score. `await observability.shutdown()` before you
read them back. Exercises 10 and 11.

**Only reference-free scorers belong on live traffic or traces.** Real requests
have no `groundTruth`, so a scorer that compares against one returns 0 on
*every* request forever — a healthy agent rendered as a flatline of failures.
`studio/` attaches `answer-relevancy` and `toxicity`, and keeps
`answer-accuracy` for datasets and experiments, where labels exist.

**A real model has no knowledge; the mock does.** The mock answers from
`NIMBUS_KNOWLEDGE`, so it looks omniscient. Swap in a real model and it
correctly says *"I don't have the Nimbus documentation"* — live relevancy was
0.0–0.65 until the facts were inlined into the agent's instructions, then
0.77–1.0. A production agent would retrieve them.

**`toolMockReport` only exists once you opt into interception.** No mocks and
no `deny` policy means no matcher is installed, so there is no receipt at all —
an unmocked suite cannot even tell you what it touched. Exercise 10a.

**`scoreTraces` needs an internal workflow that only the CLI registers.** It
drives `__batch-scoring-traces`, which `mastra dev` and `mastra build` wire up
for you — so it works on the server and throws *"Workflow with id
__batch-scoring-traces not found"* in a plain script. Register it yourself, or
use `scoreTraceBatch`, which is direct, awaited, and returns the scores instead
of logging failures somewhere you have to go looking. Exercise 11.

**Comparing across a dataset edit is meaningless, and only a warning.**
`compareExperiments` notices the version mismatch and still returns a delta.
Treating that warning as an error in CI is your job. Exercises 8 and 9.

**An experiment ignores your prompt edits unless you pin it.** Without
`agentVersion`, the target resolves straight out of the code registry — no
overrides, no published version, no warning. Prompts get edited in the browser
for weeks while CI keeps grading the prompt in the repo, and the dashboard
stays green as the deployed agent drifts. Exercise 12e.

**Saving a version does not ship it.** Save writes v2; only Publish moves
`activeVersionId`. Everything that resolves an agent normally reads
`status: 'published'`, so an unpublished version affects nothing — including
the chat pane sitting next to the editor, whose banner implies otherwise.

**A code agent's first save becomes v1 — including the edit.** Studio does not
snapshot what was in the repository first, so unless you record a baseline
version deliberately (`pnpm seed` does), the original prompt never enters the
version history and there is nothing to compare against. Exercise 12a.

**The Studio DuckDB file takes a single writer.** `pnpm seed` while `pnpm dev`
is running fails with a lock error from `observability.duckdb`. Stop the server
first — `pnpm reset` assumes you have.

## What is covered

- Custom scorers, all four steps, as plain functions and as an LLM judge
- Prebuilt scorers: 8 code (deterministic) + 15 LLM judge, including the RAG set
- Gates, thresholds (`number` or `{min, max}`), verdicts, CI exit codes
- Experiment comparison, per-scorer deltas, threshold direction, regression gating
- Dataset versioning, SCD-2 item history, pinning a run to a past version
- Tool mocks, arg matching, hermetic runs, and trace→fixture recording
- Multi-turn: holistic vs per-turn assertions
- Workflow targets: overall, per-step by id, trajectory
- Datasets, items with metadata, experiments, both execution paths
- Live sampled scoring on real traffic, and retroactive scoring of traces
- Memory-enabled agents, thread isolation strategies
- Prompt versioning via `@mastra/editor`, and version-pinned experiments

## Not covered, and why

**Experiment lifecycle hooks** (`beforeAll` / `beforeEach` / `afterEach` /
`afterAll`) and **experiment grouping** (`experimentSetId`, `comparisonId`,
`variantId`, `trialIndex` — the A/B and multi-trial dimensions) exist in the
Mastra source but are **not in the published `@mastra/core@1.57.0`** this
workshop pins. Worth mentioning in class as coming; not runnable today.

**Authoring an LLM judge in the Studio UI** is not usable in 1.57.0 either. The
backend is complete — `POST /api/stored/scorers` creates one, versions it, and
supports activate/restore/compare — but new definitions land in `status:
'draft'`, the list endpoint only returns `published`, and neither the API's
update schema nor the shipped UI exposes a transition between them. So a
created judge is invisible. Registering `@mastra/editor` does not change this —
it has a `scorer` namespace and the playground has a scorer-edit route, but the
Scorers page in this CLI version still lists code scorers with no way to author
one. Demo judge-prompt design with exercise 2 and
`shared/src/scorers/support-rubric.ts` instead.

Also worth a mention but not built here: dataset **CSV/JSON import**,
**AI-generated dataset items** (`POST /datasets/:id/generate-items`, which
reads your dataset schemas *and* the agent's own instructions and tool list),
**failure clustering** (an LLM groups failing items into tagged patterns), the
**review queue** (`needs-review | reviewed | complete` with tags), and the CLI
helpers `mastra scorers add|list` and `mastra experiment build` (which bundles a
standalone experiment worker for CI).
