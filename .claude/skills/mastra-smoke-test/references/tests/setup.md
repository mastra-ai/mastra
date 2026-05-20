# Project Setup

## Purpose

Set up or verify a Mastra project for smoke testing.

## Multi-Environment Config

One project can target multiple environments using separate config files:

| Environment | Config File                    | Platform API URL                     | Studio/Server Domain            |
| ----------- | ------------------------------ | ------------------------------------ | ------------------------------- |
| Local       | N/A (no deploy)                | N/A                                  | `localhost:4111`                |
| Staging     | `.mastra-project-staging.json` | `https://platform.staging.mastra.ai` | `*.studio.staging.mastra.cloud` |
| Production  | `.mastra-project.json`         | `https://platform.mastra.ai`         | `*.studio.mastra.cloud`         |

- **Local** = Running your Mastra project with `pnpm dev` (no cloud deploy)
- **Staging/Production** = Deploying to Mastra platform

### Setting Up Multi-Environment

After creating a project:

```bash
# Deploy to staging (creates .mastra-project-staging.json)
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai
pnpx mastra@latest auth login
pnpx mastra@latest studio deploy --config .mastra-project-staging.json -y
pnpx mastra@latest server deploy --config .mastra-project-staging.json -y

# Deploy to production (creates .mastra-project.json)
export MASTRA_PLATFORM_API_URL=https://platform.mastra.ai
pnpx mastra@latest auth login
pnpx mastra@latest studio deploy -y
pnpx mastra@latest server deploy -y
```

Each deploy creates a separate project ID in its config file, so staging and production don't interfere.

**Note**: Always warn user before running `auth login` as it opens a browser.

---

## Option A: Create New Project

### 1. Navigate to Directory

```bash
cd <directory>
# Default: ~/mastra-smoke-tests
```

### 2. Create Project

```bash
<pm> create mastra@<tag> <project-name> -c agents,tools,workflows,scorers -l <llm> -e
```

| Flag                                | Purpose                                    |
| ----------------------------------- | ------------------------------------------ |
| `-c agents,tools,workflows,scorers` | Include all components                     |
| `-l <provider>`                     | Set LLM provider (openai, anthropic, etc.) |
| `-e`                                | Include example code                       |

### 3. Enter Project

```bash
cd <project-name>
```

### 4. Record Structure

- [ ] Note if `package.json` exists
- [ ] Note if `src/mastra/index.ts` exists
- [ ] Record agents found in `src/mastra/agents/`
- [ ] Record tools found in `src/mastra/tools/`

## Option B: Use Existing Project

### 1. Navigate to Project

```bash
cd <existing-project-path>
```

### 2. Record Requirements

- [ ] Note if `package.json` contains `@mastra/core`
- [ ] Note if `src/mastra/index.ts` has Mastra instance
- [ ] Record which agents are configured

### 3. Update Dependencies (if `--tag` provided)

```bash
# Update ALL @mastra/* packages to avoid version drift
<pm> add @mastra/core@<tag> @mastra/memory@<tag> mastra@<tag>

# Also update any adapters in package.json:
# @mastra/libsql, @mastra/pg, @mastra/turso, @mastra/duckdb
# @mastra/evals, @mastra/observability, @mastra/stagehand
```

**Important**: Check `package.json` first — only update packages that exist.

## Storage Backend (`--db`)

| Backend            | Package          | Env Variables                            |
| ------------------ | ---------------- | ---------------------------------------- |
| `libsql` (default) | `@mastra/libsql` | None                                     |
| `pg`               | `@mastra/pg`     | `DATABASE_URL`                           |
| `turso`            | `@mastra/turso`  | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |

### Install Non-Default Backend

```bash
<pm> add @mastra/<backend>
```

### Configure in `src/mastra/index.ts`

```typescript
import { LibSQLStore } from '@mastra/libsql'; // or PgStore, TursoStore

export const mastra = new Mastra({
  // ...
  storage: new LibSQLStore({
    /* config */
  }),
});
```

## Browser Agent (`--browser-agent`)

### 1. Install Packages

```bash
<pm> add @mastra/stagehand @mastra/memory
```

### 2. Create Agent

Create `src/mastra/agents/browser-agent.ts`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { StagehandBrowser } from '@mastra/stagehand';

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  instructions: `You are a helpful assistant that can browse the web.`,
  model: '<provider>/<model>',
  memory: new Memory(),
  browser: new StagehandBrowser({
    headless: false, // true for cloud deploys
  }),
});
```

### 3. Register Agent

Update `src/mastra/index.ts`:

```typescript
import { browserAgent } from './agents/browser-agent';

export const mastra = new Mastra({
  agents: { weatherAgent, browserAgent },
  // ...
});
```

### 4. Install Playwright

```bash
<pm> exec playwright install chromium
```

## Custom API Routes

To add custom API routes:

### 1. Create Route

Create `src/mastra/routes/hello.ts`:

```typescript
import { registerApiRoute } from '@mastra/core/server';

export const helloRoute = registerApiRoute('/hello', {
  method: 'GET',
  requiresAuth: false, // Set to true if auth required
  handler: async c => {
    return c.json({ message: 'Hello from custom route!' });
  },
});
```

### 2. Register Route

Update `src/mastra/index.ts`:

```typescript
import { helloRoute } from './routes/hello';

export const mastra = new Mastra({
  // ...
  server: {
    apiRoutes: [helloRoute], // ⚠️ Must be "apiRoutes", not "routes"
  },
});
```

**Common mistake**: Using `routes` instead of `apiRoutes` - this will silently fail.

### 3. Verify Locally

```bash
# Start dev server
<pm> run dev

# Test route
curl http://localhost:4111/hello
```

## Environment Variables

### Check/Set LLM API Key

```bash
# Check if set
echo $OPENAI_API_KEY  # or ANTHROPIC_API_KEY, etc.

# Or check .env file
cat .env | grep API_KEY
```

If not set, add to `.env`:

```
OPENAI_API_KEY=sk-...
```

### Platform URL (Cloud Only)

```bash
# Staging
export MASTRA_PLATFORM_API_URL=https://platform.staging.mastra.ai

# Production (default - can be unset)
unset MASTRA_PLATFORM_API_URL
```

## Verification Checklist

| Check                | Command                   |
| -------------------- | ------------------------- |
| Project exists       | `ls package.json`         |
| Dependencies         | `<pm> list @mastra/core`  |
| Mastra config        | `cat src/mastra/index.ts` |
| Agents exist         | `ls src/mastra/agents/`   |
| Env vars             | `cat .env`                |
| **TypeScript check** | `<pm> tsc --noEmit`       |

### TypeScript Check (Required)

**Always run `tsc --noEmit` after modifying config files.** This catches most config mistakes that `mastra build` silently ignores:

- Wrong property names (`routes` vs `apiRoutes`)
- Type mismatches (`timeout: "30"` vs `timeout: 30`)
- Missing imports
- Unknown properties

```bash
<pm> tsc --noEmit
# Record any errors that appear
```

If errors appear, fix them before proceeding. Don't rely on `mastra build` or `pnpm dev` to catch these.

## Common Issues

| Issue                               | Fix                                           |
| ----------------------------------- | --------------------------------------------- |
| "Cannot find module '@mastra/core'" | Run `<pm> install`                            |
| "Missing API key"                   | Add to `.env` file                            |
| "No agents found"                   | Check agent exports in index.ts               |
| Custom routes not working           | Use `server.apiRoutes`, not `server.routes`   |
| Config errors not caught by build   | Run `tsc --noEmit` - build doesn't type-check |
