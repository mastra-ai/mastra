# Studio Preview

This app is the Vercel target for PR previews of Mastra Studio. It deploys Studio and a minimal Mastra API together, so reviewers can test agents and workflows with populated demo data.

It lives inside `packages/playground` because previewing Studio is its whole point, but it is internal preview infrastructure, not part of the published package: its own `pnpm-workspace.yaml` makes this directory its own workspace root, so it keeps its own lockfile without ever being installed as part of the monorepo, and its monorepo-only patterns (`link:` dependencies, a root turbo build) must not be copied into user-facing examples. Edits here count as playground changes for turbo and the changeset-bot; that is accepted noise since the app rarely changes, and no changeset is needed for preview-only edits.

The app is intentionally serverless-friendly:

- in-memory storage only — no file-backed storage, no LibSQL or DuckDB dependency
- one deterministic tool
- one memory-enabled agent that can be opened at `/agents/studio-preview-agent/chat/new`
- five deterministic workflows, with seeded history for approval, batch processing, and countdown
- deterministic demo data seeded on startup so most Studio surfaces render populated

## Seeded demo data

On startup the app seeds a shared in-memory store (`src/mastra/store.ts`, populated by `src/mastra/seed/`) so reviewers can preview data-heavy Studio surfaces without manually creating anything:

- **Threads** — a few chat threads with messages for the preview agent (sidebar on the agent chat page)
- **Traces** — agent runs with model and tool spans under Observability
- **Metrics** — token usage, model cost, agent/tool latency, and active threads/resources, all within the default 24h window (Model Usage & Cost, Token usage by agent, Traces volume, Latency, Memory cards)
- **Scores** — two deterministic scorers (`answer-relevance`, `tone-quality`) with score rows and aggregates
- **Datasets** — two datasets with items
- **Workflows** — approval runs in completed, suspended, and failed states, plus completed batch and loop runs

The data is deterministic and free to produce (no model calls, no provider key needed for the seed itself). Because the store is in-memory, it is **not durable**: every cold start re-seeds its own process, so the demo data is always present but anything created live in a preview session may not survive across serverless instances. This is intentional for a preview.

## Workflow examples

The workflows under `src/mastra/workflows/` run without API keys or external services. Input schemas include defaults so reviewers can start a run immediately:

- **request-review** — requests up to 1,000 follow the automatic approval branch. Larger requests suspend at `review-request`; resume with `approved: true` to complete or `approved: false` to inspect a failed run. Its history includes both approval paths, a declined request, and a request awaiting review.
- **document-batch** — processes three sample documents with foreach and a nested workflow. Open the nested graph to inspect parallel word-count and excerpt steps, then inspect the mapped report.
- **countdown** — repeats a step until the remaining count reaches zero. Inputs are bounded from 0 to 10.
- **delayed-report** — waits eight seconds before returning the supplied message. Run it to inspect a real waiting state and its transition to completion.
- **order-fulfillment** — a longer scenario with parallel inventory/risk checks, approval branches, a nested packing workflow, a foreach loop with concurrency two, parallel label/quality steps per item, a two-second delay, and dispatch. Local delays make running states visible; nothing is purchased, printed, or shipped.

Try these order-fulfillment inputs:

| Behavior               | Input and action                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Complete automatically | Set Approval to `automatic`, then Run.                                                                               |
| Human approval         | Keep Approval `manual`; Run pauses at request-approval. Check Approved and Resume.                                   |
| Rejection              | Use manual approval, uncheck Approved, then Resume. Packing never starts.                                            |
| Dispatch failure       | Set Approval to `automatic` and enable Fail Dispatch. Packing completes before dispatch fails.                       |
| Cancellation           | Run with automatic approval and cancel while a step is running.                                                      |
| Debugging              | Enable Step by step and press Start debug. Inspect outputs between Run next step actions. See the limitations below. |

The timeline appears after the run has step events. Open a recent run or start a new one, then expand **Timeline** at the bottom of the canvas. It is hidden on a new workflow before execution because there are no timings yet. Approval suspension is separate from debug pausing: it requires response data and **Resume**.

Known debug limitations with this advanced example: **Continue full run** from an unfinished parallel section can omit a sibling output, and resuming manual approval after stepping through its branch can leave the run suspended. Normal execution, including manual approval/resume, is unaffected. Use the normal Run path when checking end-to-end completion.

Workflow cards combine a running title shimmer with the shared activity edge. Nested workflows and loops expand inline inside dashed groups. Completed foreach runs expose an item selector for inspecting each iteration’s actual step results. Data controls open the floating inspector while keeping the canvas interactive.

`src/mastra/seed/workflow-runs.ts` generates the history by executing these workflows through Mastra, including suspend/resume. Startup awaits this seed so the first workflow request sees populated history. Repeated seed calls reuse the same promise and preserve live review decisions within the process.

## Local usage

From the repository root:

```bash
pnpm --dir packages/playground/vercel-preview install --frozen-lockfile
pnpm --dir packages/playground/vercel-preview build
```

For local Studio development:

```bash
cp packages/playground/vercel-preview/.env.example packages/playground/vercel-preview/.env
pnpm --dir packages/playground/vercel-preview dev
```

## Vercel project setup

Create one Vercel project for the repository and point it at this app. If the project predates the move out of `examples/`, update its Root Directory setting from `examples/studio-preview` to `packages/playground/vercel-preview` when this change lands — previews of branches created before the move will fail until they are rebased.

- Root Directory: `packages/playground/vercel-preview`
- Build Command: `pnpm build`
- Install Command: `pnpm install --frozen-lockfile`
- Output Directory: leave empty
- Node.js Version: 22.x
- Root Directory setting: enable source files outside the root directory

Configure the Vercel project to create preview deployments for PRs only. The repository does not include a branch allowlist or production skip script, so production deployment behavior should be controlled in the Vercel project settings.

Add these environment variables for Preview deployments:

```text
OPENAI_API_KEY=...
```

You can also configure Anthropic:

```text
ANTHROPIC_API_KEY=...
```

If both `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are configured, Studio can show both connected providers in its model controls.
The preview agent uses OpenAI by default when it is configured, then falls back to Anthropic. To override the default agent model, set `MASTRA_PREVIEW_MODEL` to a placeholder token such as `__GATEWAY_ANTHROPIC_MODEL_SONNET__` or to a concrete `provider/model` ID.

All Mastra packages the app uses (`mastra`, `@mastra/deployer-vercel`, `@mastra/core`, `@mastra/memory`, `@mastra/editor`) are linked from the workspace, so the preview always runs the code from the current branch and no published version pin can drift out of the linked packages' peer ranges. Before the turbo build, `scripts/build-linked-workspace-deps.mjs` installs the linked packages' dependency graph at the repository root (with the pnpm version from the root `packageManager` field), so the build also succeeds when the turbo remote cache misses. Vercel still deploys only the generated output for this app, not the full repository.

Vercel will use the generated `.vercel/output` folder. Studio is served at `/`, and the Mastra API is served under `/api/*`.

Recommended preview URLs:

- `/` for the Studio shell
- `/agents` for the agent list
- `/agents/studio-preview-agent/chat/new` for the working agent chat (seeded threads in the sidebar)
- `/observability` for seeded traces
- `/metrics` for seeded usage, cost, latency, and memory metrics
- `/scorers` for seeded scorers and scores
- `/datasets` for seeded datasets and items
- `/workflows` for runnable examples and seeded run history

Protect the project with Vercel Deployment Protection or Studio auth before exposing previews broadly. Studio has access to the agents, tools, and workflows exposed by the Mastra server.
