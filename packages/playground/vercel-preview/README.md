# Studio Preview

This app is the Vercel target for PR previews of Mastra Studio. It deploys Studio and a minimal Mastra API together, so reviewers can open the preview URL and test a working agent page.

It lives inside `packages/playground` because previewing Studio is its whole point, but it is internal preview infrastructure, not part of the published package. It is a workspace package like any other, depending on `@mastra/*` with `workspace:*`, so the deployer packs those packages from source and the preview always runs the branch it deploys. Its deploy script is `build:vercel`, not `build`, so the repo-wide `build` never bundles it. No changeset is needed for preview-only edits.

The app is intentionally serverless-friendly:

- in-memory storage only — no file-backed storage, no LibSQL or DuckDB dependency
- one deterministic tool
- one memory-enabled agent that can be opened at `/agents/studio-preview-agent/chat/new`
- deterministic demo data seeded on startup so most Studio surfaces render populated

## Seeded demo data

On startup the app seeds a shared in-memory store (`src/mastra/store.ts`, populated by `src/mastra/seed/`) so reviewers can preview data-heavy Studio surfaces without manually creating anything:

- **Threads** — a few chat threads with messages for the preview agent (sidebar on the agent chat page)
- **Traces** — agent runs with model and tool spans under Observability
- **Metrics** — token usage, model cost, agent/tool latency, and active threads/resources, all within the default 24h window (Model Usage & Cost, Token usage by agent, Traces volume, Latency, Memory cards)
- **Scores** — two deterministic scorers (`answer-relevance`, `tone-quality`) with score rows and aggregates
- **Datasets** — two datasets with items

The data is deterministic and free to produce (no model calls, no provider key needed for the seed itself). Because the store is in-memory, it is **not durable**: every cold start re-seeds its own process, so the demo data is always present but anything created live in a preview session may not survive across serverless instances. This is intentional for a preview.

## Local usage

From the repository root:

```bash
pnpm install --frozen-lockfile --filter studio-preview...
pnpm turbo build:vercel --filter studio-preview
```

For local Studio development:

```bash
cp packages/playground/vercel-preview/.env.example packages/playground/vercel-preview/.env
pnpm turbo dev --filter studio-preview
```

## Vercel project setup

Create one Vercel project for the repository and point it at this app. If the project predates the move out of `examples/`, update its Root Directory setting from `examples/studio-preview` to `packages/playground/vercel-preview` when this change lands — previews of branches created before the move will fail until they are rebased.

- Root Directory: `packages/playground/vercel-preview`
- Build Command: `MASTRA_AGENT_SIGNALS=false pnpm turbo build:vercel --filter studio-preview --concurrency=2`
- Install Command: `pnpm install --frozen-lockfile --filter studio-preview...`
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

Every Mastra package the app uses (`mastra`, `@mastra/deployer-vercel`, `@mastra/core`, `@mastra/memory`, `@mastra/editor`) comes from the workspace, so the deployer packs them as tarballs from the branch's own source: the deployed bundle never resolves an `@mastra/*` version from npm, and a version bumped ahead of what is published cannot break the build. Turbo builds those packages first through the task graph. Vercel still deploys only the generated output for this app, not the full repository.

Vercel will use the generated `.vercel/output` folder. Studio is served at `/`, and the Mastra API is served under `/api/*`.

Recommended preview URLs:

- `/` for the Studio shell
- `/agents` for the agent list
- `/agents/studio-preview-agent/chat/new` for the working agent chat (seeded threads in the sidebar)
- `/observability` for seeded traces
- `/metrics` for seeded usage, cost, latency, and memory metrics
- `/scorers` for seeded scorers and scores
- `/datasets` for seeded datasets and items

Protect the project with Vercel Deployment Protection or Studio auth before exposing previews broadly. Studio has access to the agents, tools, and workflows exposed by the Mastra server.
