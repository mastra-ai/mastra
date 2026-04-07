# Project Setup

## Purpose
Set up or verify a Mastra project for smoke testing.

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

| Flag | Purpose |
|------|---------|
| `-c agents,tools,workflows,scorers` | Include all components |
| `-l <provider>` | Set LLM provider (openai, anthropic, etc.) |
| `-e` | Include example code |

### 3. Enter Project
```bash
cd <project-name>
```

### 4. Verify Structure
- [ ] `package.json` exists
- [ ] `src/mastra/index.ts` exists
- [ ] `src/mastra/agents/` has at least one agent
- [ ] `src/mastra/tools/` has at least one tool

## Option B: Use Existing Project

### 1. Navigate to Project
```bash
cd <existing-project-path>
```

### 2. Verify Requirements
- [ ] `package.json` with `@mastra/core`
- [ ] `src/mastra/index.ts` with Mastra instance
- [ ] At least one agent configured

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

| Backend | Package | Env Variables |
|---------|---------|---------------|
| `libsql` (default) | `@mastra/libsql` | None |
| `pg` | `@mastra/pg` | `DATABASE_URL` |
| `turso` | `@mastra/turso` | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` |

### Install Non-Default Backend
```bash
<pm> add @mastra/<backend>
```

### Configure in `src/mastra/index.ts`
```typescript
import { LibSQLStore } from '@mastra/libsql'; // or PgStore, TursoStore

export const mastra = new Mastra({
  // ...
  storage: new LibSQLStore({ /* config */ }),
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

| Check | Command |
|-------|---------|
| Project exists | `ls package.json` |
| Dependencies | `<pm> list @mastra/core` |
| Mastra config | `cat src/mastra/index.ts` |
| Agents exist | `ls src/mastra/agents/` |
| Env vars | `cat .env` |

## Common Issues

| Issue | Fix |
|-------|-----|
| "Cannot find module '@mastra/core'" | Run `<pm> install` |
| "Missing API key" | Add to `.env` file |
| "No agents found" | Check agent exports in index.ts |
