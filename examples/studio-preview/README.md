# Studio Preview Example

This example is a small Vercel target for PR previews of Mastra Studio. It deploys Studio and a minimal Mastra API together, so reviewers can open the preview URL and test a working agent page.

The example is intentionally serverless-friendly:

- in-memory storage only — no file-backed storage, no LibSQL or DuckDB dependency
- one deterministic tool
- one memory-enabled agent that can be opened at `/agents/studio-preview-agent/chat/new`
- deterministic demo data seeded on startup so most Studio surfaces render populated

## Seeded demo data

On startup the example seeds a shared in-memory store (`src/mastra/store.ts`, populated by `src/mastra/seed/`) so reviewers can preview data-heavy Studio surfaces without manually creating anything:

- **Threads** — a few chat threads with messages for the preview agent (sidebar on the agent chat page)
- **Traces** — agent runs with model and tool spans under Observability
- **Metrics** — token usage, model cost, agent/tool latency, and active threads/resources, all within the default 24h window (Model Usage & Cost, Token usage by agent, Traces volume, Latency, Memory cards)
- **Scores** — two deterministic scorers (`answer-relevance`, `tone-quality`) with score rows and aggregates
- **Datasets** — two datasets with items

The data is deterministic and free to produce (no model calls, no provider key needed for the seed itself). Because the store is in-memory, it is **not durable**: every cold start re-seeds its own process, so the demo data is always present but anything created live in a preview session may not survive across serverless instances. This is intentional for a preview.

## Local usage

From the repository root:

```bash
corepack pnpm@10.29.3 --dir examples/studio-preview install --frozen-lockfile --ignore-workspace
corepack pnpm@10.29.3 --dir examples/studio-preview build
```

For local Studio development:

```bash
cp examples/studio-preview/.env.example examples/studio-preview/.env
pnpm --dir examples/studio-preview dev
```

## Vercel project setup

Create one Vercel project for the repository and point it at this example.

- Root Directory: `examples/studio-preview`
- Build Command: `pnpm build`
- Install Command: `pnpm install --frozen-lockfile --ignore-workspace`
- Output Directory: leave empty
- Node.js Version: 22.x
- Root Directory setting: enable source files outside the root directory

Configure the Vercel project to create preview deployments for PRs only. The repository example does not include a branch allowlist or production skip script, so production deployment behavior should be controlled in the Vercel project settings.

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

The build compiles the linked CLI and Vercel deployer workspace packages so the preview uses Studio assets from the current branch. The sample API uses a published `@mastra/core` version so Vercel does not depend on unpublished monorepo package versions. Vercel still deploys only the generated output for this example, not the full repository.

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
