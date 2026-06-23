# Studio Preview Example

This example is a small Vercel target for PR previews of Mastra Studio. It deploys Studio and a minimal Mastra API together, so reviewers can open the preview URL and test a working agent page.

The example is intentionally serverless-friendly:

- no file-backed storage
- no LibSQL or DuckDB dependency
- one deterministic tool
- one agent that can be opened at `/agents/studio-preview-agent/chat/new`

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
- `/agents/studio-preview-agent/chat/new` for the working agent chat

Protect the project with Vercel Deployment Protection or Studio auth before exposing previews broadly. Studio has access to the agents, tools, and workflows exposed by the Mastra server.
