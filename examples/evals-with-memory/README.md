# Mastra for people who don't write the code

An example built around a question the docs don't currently answer: **what can a
product manager or a subject-matter expert actually do with a Mastra agent?**

The answer turns out to be "most of the interesting parts" — rewrite what the
agent says, ship that change, prove it helped or hurt, turn a bad conversation
into a permanent test case, and add knowledge as a markdown file. None of that
needs a pull request. All of it needs someone who knows the subject better than
the engineer does.

Everything here runs on one small support agent for a fictional file-sync
company, so the domain never gets in the way of the mechanics.

```
studio/           persistent DB + seeded dashboard   ← the browser half
headless/         12 runnable exercises, CI-safe     ← the same story in code
shared/           the agent, the scorers, the dataset
local-packages/   3 earlier memory-eval scripts, separate workspace
```

## What someone without a terminal can do here

Every row is a thing to click, and a thing it proves.

| They can | Where | Why it matters |
|---|---|---|
| Rewrite the agent's instructions and ship it | Agents → Editor | Prompt changes stop being a deploy |
| See what that edit did, as a number | Evaluation → Datasets → Experiments | "This reads better" becomes measurable |
| Turn a real conversation into a test case | Observability → Traces → **Save as Dataset Item** | Answers where datasets come from |
| Rate an answer, leave a correction | Trace panel → **Feedback** | Human judgment stored beside machine scores |
| Add knowledge as a markdown file | Workspaces → Skills | No code, no deploy, no engineer |
| Re-grade past traffic against a new standard | Trace panel → **Evaluate Trace** | Yesterday's conversations, today's bar |

The engineer keeps what should stay theirs. The editor can override
`instructions` and `tools` and nothing else — `model`, `memory` and `scorers`
hold live objects that can't survive a database row. That boundary is a
feature: the model is pinned, so a score that moves between two prompt
versions moved *because of the prompt*.

## Setup

```bash
pnpm install
cp .env.example .env     # optional — see below
pnpm seed                # dataset + 3 experiments telling a regression story
pnpm dev                 # http://localhost:4111
```

Everything except exercise 2 runs with **no API key**. The agent uses a
deterministic mock model, so every number in this README is reproducible
byte-for-byte. Add a key and the Studio agent switches to `openai/gpt-5-mini`,
the LLM-judge scorers attach themselves, and live chat gets scored as it
arrives.

`pnpm seed` deliberately does *not* load `.env`, so seeded history is identical
on every machine while live chat uses the real model. Reproducible past, real
present, one dashboard.

## The browser half

### Editing the prompt, and shipping it

**Agents → Nimbus Support Agent → Editor.** System prompt on the left, live
chat on the right, version picker on top. `pnpm seed` snapshots the code prompt
as **v1** and publishes it, so the tab opens on a real baseline instead of "No
versions yet."

Try the edit a real support lead would ask for — append *"Avoid overwhelming
the customer with specific numbers"* — then:

| Button | What it actually does |
|---|---|
| **Save New Version** | Writes v2. Changes nothing for anyone. |
| **Publish** | Points the live agent at v2. This is the one that ships. |

Save and Publish being separate is worth saying out loud, because the editor's
own banner blurs it: *"Save your draft to ensure the chat uses your latest
changes"* is not true. Agents resolve at `status: 'published'`, chat pane
included. Verified here — with v2 saved and v1 published, the server still
serves v1.

### Proving the edit helped

That friendlier prompt is a plausible, well-meant, actively harmful change: it
takes `answer-accuracy` from **0.875 to 0.125**, because the numbers it removes
were the answers. Nobody would catch that by reading it.

**Evaluation → Datasets → nimbus-support-qa** has three seeded experiments —
baseline `0.875`, regression `0.375`, fix `0.875`. Noticing a regression you
didn't intend is the whole argument for evals, and that shape is the lesson.

`pnpm ex:12` runs the same comparison in the terminal and ends on the trap: an
experiment that isn't pinned to a version silently grades the prompt in the
*code*, which by then is neither version anyone is arguing about.

### Where datasets come from

**Observability → Traces**, click any `agent run`. The panel has three buttons,
and each is one of the last three exercises:

| Button | The exercise it is |
|---|---|
| **Save as Dataset Item** | The production→dataset loop |
| **Add tool mocks to item** | Exercise 10's `collectToolMocks` |
| **Evaluate Trace** → Scoring → **Start Scoring** | Exercise 11's `scoreTraces` |

**Save as Dataset Item** is the one to spend time on. It opens pre-filled from
the trace: the real question as `input`, the agent's actual answer as
`groundTruth` (edit it to what it *should* have said), the step sequence as
`expectedTrajectory`, the tool calls as `toolMocks`. A support lead who spots a
bad answer converts it into a permanent regression test without describing it
to anyone.

The same panel has a **Feedback** tab — thumbs, ratings and corrections, stored
next to the machine scores rather than in a spreadsheet.

### Knowledge as markdown

**Workspaces** opens `studio/workspace/`: a **Files** tab that browses and
searches it, and a **Skills** tab listing every directory containing a
`SKILL.md`.

Skills are just markdown — a directory, a `SKILL.md` with `name` and
`description` frontmatter, and whatever supporting files it needs.
`skills/eval-triage/` keeps a `references/score-reasons.md` beside its
`SKILL.md`, which is the multi-file shape the Agent Skills spec expects.
Adding a skill means adding a directory; nothing is registered in code.

**Add Skill** searches [skills.sh](https://skills.sh) and installs into the
same directory, so one page covers both hand-written and third-party skills.

The workspace is registered on the `Mastra` instance, which makes it *global* —
agents inherit it. It's independent of the editor: skills appear here whether
or not `@mastra/editor` is configured.

> The agent editor's own **Skills** section is a different thing and stays
> hidden — see "Not covered, and why."

### Chatting, and being graded for it

Chat under **Agents**. With a key, `answer-relevancy` and `toxicity` score
every reply as it arrives and land under **Evaluation → Overview**.

Which scorers belong on live traffic is a real decision. Real requests have no
`groundTruth`, so only *reference-free* scorers work here — `answer-accuracy`
would return 0 on every request forever and paint a healthy agent as a
flatline. It stays where labels exist: datasets and experiments.

## The same story in code

The dashboard is more convincing when the numbers behind it are reproducible.
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

The arc is a loop, not a list:

```
production traffic → dataset → experiment → compare → gate → fix → back to production
        11              10,9        6,7         8       8,3
```

**8 — comparing.** A gate asks *is this acceptable at all*; `compareExperiments`
asks *is this worse than last time*. A release can pass every gate and still be
a clear regression. Thresholds carry a `direction`, because plenty of things
you score are costs — latency, tokens, tool calls — where up is bad.

**9 — versioning.** Manufactures a lie: edit one question the agent kept
failing and the score jumps 0.875 → 1.000 with the agent untouched. Pinning to
the old version reproduces 0.875 and proves the data moved, not the model.

**10 — tool mocks.** The flagship. The same item passes, then fails, because a
row changed in a database. Mocks pin it, `unmockedToolPolicy: 'deny'` proves
nothing leaked, and `collectToolMocks` reads a real trace and writes the mocks
for you — production incident to deterministic regression test in one step.

**11 — scoring history.** Inverts the usual order: the traffic happened first,
the scorer came second. Write a scorer today, learn how the agent has been
doing on it since March. Nothing is re-run.

**12 — the prompt itself.** The thing teams change most often and measure
least.

## Things worth stopping on

Each has a comment block in the file that raises it. Most are **silent** — no
error, just wrong numbers — which is the real reason they're worth a slide.

**Saving a version does not ship it.** Save writes v2; only Publish moves
`activeVersionId`. Everything resolving an agent reads `status: 'published'`,
so an unpublished version affects nothing — including the chat pane next to the
editor, whose banner implies otherwise.

**A code agent's first save becomes v1 — including the edit.** Studio doesn't
snapshot the repository first, so unless you record a baseline deliberately
(`pnpm seed` does), the original prompt never enters version history and there
is nothing to compare against. Exercise 12a.

**An experiment ignores prompt edits unless you pin it.** Without
`agentVersion` the target resolves out of the code registry — no overrides, no
published version, no warning. Prompts get edited in the browser for weeks
while CI keeps grading the prompt in the repo, and the dashboard stays green as
the deployed agent drifts. Exercise 12e.

**A missed threshold does not fail the run.** Only gates produce
`verdict: 'failed'`; a threshold miss yields `'scored'`. CI written as
`if (verdict === 'failed') exit(1)` merges straight through a quality
regression. Exercise 3 shows the correct check, exercise 8 the better one.

**Comparing across a dataset edit is meaningless, and only a warning.**
`compareExperiments` notices the version mismatch and still returns a delta.
Treating that warning as an error in CI is your job. Exercises 8 and 9.

**Agent output is not a string.** `runEvals` hands scorers `MastraDBMessage[]`,
whose `content` is an object. A scorer that only handles strings silently
scores 0 on every row. See `extractText` in
`shared/src/scorers/answer-accuracy.ts`.

**Scorers must be registered on the `Mastra` instance to persist.** Skip it and
runs still print scores, but every save logs
`MASTRA_GET_SCORER_BY_ID_NOT_FOUND` and the dashboard stays empty — a terminal
that looks fine and a dashboard that looks broken.

**`getScorerById` resolves `scorer.id`, not your registration key.** Prebuilt
scorers name themselves with a suffix (`answer-relevancy-scorer`). Register one
under a tidier key, ask for that key, and you get a not-found for a scorer
sitting right there. Exercise 11.

**Code scorers are ~660× faster than judges.** Measured: 4 items × 3 code
scorers in **124 ms**, then 4 items × 2 LLM judges in **82,311 ms**.

**A judge can only grade what you show it.** `support-rubric` sees
`groundTruth` and nothing else, so it marks *true* extra detail as invented —
0.667 on an answer that is entirely correct. Design bug, not model failure.

**LibSQL cannot serve the Evaluation dashboard, or store spans.** Studio's
Overview and Scorers views call the generic `listScores()`, which LibSQL
doesn't implement, so those pages return `500 — "This storage provider does not
support listing scores"`. Only **clickhouse, convex, duckdb, oracledb, pg**
implement it. That's why both surfaces run a `MastraCompositeStore`: LibSQL for
everything, DuckDB for observability alone.

**Live scoring needs an `Observability` config, or it silently does nothing.**
Scores from agent-attached scorers hang off trace spans. Without an exporter
there are no spans, so no scores are written — and nothing errors.

**A short-lived script writes zero traces unless you flush.** Spans export in
batches; a script that generates traffic and exits takes the pending batch with
it. `await observability.shutdown()` first. Exercises 10 and 11.

**Paths must be absolute — for the database and the workspace.** Under
`mastra dev` the process runs from `src/mastra/public`, not the project root,
so a relative `file:./x.db` gives scripts and server two different databases,
and a relative workspace `basePath` browses an empty directory and finds no
skills. Nothing is logged either way. See `studio/src/mastra/db-path.ts`.

**Experiments take `targetType` + `targetId`, not an object.** Passing
`target: agent` fails with *"No task: provide targetType+targetId or task"*.

**`runEvals` owns the thread on the multi-turn path.** A single `input` passes
your `memory.thread` through untouched; `inputs`/`turns` generates one per item
and overrides yours. Per-item isolation is `inputs: [question]` — no manual
loop. Exercise 4.

**`scoreTraces` needs an internal workflow only the CLI registers.** It drives
`__batch-scoring-traces`, which `mastra dev` wires up — so it works on the
server and throws in a plain script. Use `scoreTraceBatch` instead, which is
direct and returns the scores. Exercise 11.

**`toolMockReport` only exists once you opt into interception.** No mocks and
no `deny` policy means no matcher is installed, so an unmocked suite can't even
tell you what it touched. Exercise 10a.

**A real model has no knowledge; the mock does.** The mock answers from
`NIMBUS_KNOWLEDGE`, so it looks omniscient. A real model correctly says *"I
don't have the Nimbus documentation"* — live relevancy was 0.0–0.65 until the
facts were inlined into the instructions, then 0.77–1.0. A production agent
would retrieve them.

**The DuckDB file takes a single writer.** `pnpm seed` while `pnpm dev` is
running fails with a lock error. Stop the server first — `pnpm reset` assumes
you have.

## What is covered

- Editing, versioning and publishing a prompt from the browser, and pinning an
  experiment to a version
- A workspace with filesystem-backed skills, browsable and searchable in Studio
- Custom scorers, all four steps, as plain functions and as an LLM judge
- Prebuilt scorers: 8 code (deterministic) + 15 LLM judge, including the RAG set
- Gates, thresholds (`number` or `{min, max}`), verdicts, CI exit codes
- Experiment comparison, per-scorer deltas, threshold direction, regression gating
- Dataset versioning, SCD-2 item history, pinning a run to a past version
- Tool mocks, arg matching, hermetic runs, and trace→fixture recording
- Multi-turn: holistic vs per-turn assertions
- Workflow targets: overall, per-step by id, trajectory
- Live sampled scoring on real traffic, and retroactive scoring of traces
- Memory-enabled agents, thread isolation strategies

## Not covered, and why

**The agent's other editor sections.** A code-defined agent's CMS sidebar is
hard-limited to `Instructions`, `Tools` and `Variables`. The other four —
Scorers, Workflows, Skills, Memory — only appear for a DB-defined agent, and
Skills is *additionally* gated behind the Enterprise Agent Builder. Workspace
skills (above) give you the skills system without either. This agent currently
registers no tools and no `requestContextSchema`, so two of its three available
sections render empty — the most obvious next thing to add.

**Authoring an LLM judge in the Studio UI** is not usable in
`@mastra/core@1.57.0`. The backend is complete — `POST /api/stored/scorers`
creates one, versions it, supports activate/restore — but new definitions land
in `status: 'draft'`, the list endpoint returns only `published`, and nothing
exposes a transition. A created judge is invisible. Demo judge design with
exercise 2 and `shared/src/scorers/support-rubric.ts` instead.

**Experiment lifecycle hooks** (`beforeAll` / `beforeEach` / …) and **experiment
grouping** (`experimentSetId`, `comparisonId`, `variantId`, `trialIndex`) exist
in the Mastra source but not in the published version pinned here.

**Shipped in Studio, not yet demonstrated here:** dataset CSV/JSON import (a
full upload → map columns → validate wizard), AI-generated dataset items
(`POST /datasets/:id/generate-items`, which reads your schemas *and* the
agent's instructions and tool list), failure clustering, the review queue
(`needs-review | reviewed | complete` with tags and ratings), prompt blocks
(reusable instruction text shared across agents, at **Prompts** in the
sidebar), and role impersonation for previewing Studio as a collaborator.
Each is a strong non-engineer story and none is built into this example yet.
