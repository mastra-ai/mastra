# Sandbox Deployer Example

Deploys a minimal Mastra server (one agent, one tool, plus Studio) into a sandbox microVM using `@mastra/deployer-sandbox`, and prints a live public URL. Supports three providers — Vercel Sandbox (default), E2B, and Daytona — selected with the `SANDBOX_PROVIDER` env var.

Sandboxes are ephemeral compute — use this for instant previews, CI smoke deploys, and verifying agent-built apps, not production hosting.

## Setup

Install dependencies (this example is a standalone pnpm workspace linked to the repo's packages):

```bash
corepack pnpm@10.29.3 --dir examples/sandbox-deployer install --ignore-workspace
```

Authenticate with Vercel using the Vercel CLI (matches the [Vercel Sandbox quickstart](https://vercel.com/docs/sandbox/quickstart)):

```bash
cd examples/sandbox-deployer
vercel link          # link (or create) a Vercel project
vercel env pull      # writes VERCEL_OIDC_TOKEN to .env.local
```

Alternatively, copy `.env.example` to `.env` and set `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`.

Add a model provider key to `.env` so the agent can generate:

```bash
echo "OPENAI_API_KEY=sk-..." >> .env
```

## Deploy

```bash
pnpm build
```

This builds the linked workspace packages and runs `mastra build`, which bundles the project and deploys it into the sandbox in one step. The deploy prints the API and Studio URLs and writes `.mastra/output/sandbox-deployment.json`.

Note: the OIDC token from `vercel env pull` expires after 12 hours — re-run `vercel env pull` if auth starts failing.

### Deploy to E2B instead

The provider is picked in `src/mastra/sandbox.ts` — set `SANDBOX_PROVIDER=e2b` (and `E2B_API_KEY`) to deploy the same app to an E2B sandbox:

```bash
SANDBOX_PROVIDER=e2b E2B_API_KEY=e2b_... pnpm build
```

E2B pauses the sandbox on timeout instead of killing it, and resumes running processes on wake — so a woken deployment answers immediately without a server relaunch.

### Deploy to Daytona instead

Set `SANDBOX_PROVIDER=daytona` (and `DAYTONA_API_KEY`) to deploy the same app to a Daytona sandbox:

```bash
SANDBOX_PROVIDER=daytona DAYTONA_API_KEY=dtn_... pnpm build
```

The sandbox is created with `public: true` so the preview URL works without a token. Stopping persists the filesystem but not processes, so waking relaunches the server (like Vercel).

## Lifecycle

Manage the deployment with `getDeployment()` from `@mastra/deployer-sandbox/client` (`stop()`, `destroy()`, `logs()`, wake-on-demand). The sandbox name is the identity, so the scripts — or any other codebase — just construct the provider with the same name:

```bash
pnpm stop      # snapshot-stop (resumes on next deploy) — see scripts/stop.ts
pnpm destroy   # permanently delete the sandbox — see scripts/destroy.ts
```

Set `SANDBOX_PROVIDER=e2b` (or `daytona`) on these too when managing a deployment on another provider.

Both work from a fresh process: the provider attaches to the named sandbox without resuming it, so stopping or destroying never wakes (or bills) a stopped sandbox first. The Vercel CLI works too (`vercel sandbox ls|stop|rm`).

Redeploys (`pnpm build` again) reuse the named sandbox and skip `npm install` when the install inputs (`package.json`, bundled lockfiles, and the install command) are unchanged.

See the [sandbox deployment docs](https://mastra.ai/docs/deployment/sandbox) for routing tiers, security notes, and CI recipes.
