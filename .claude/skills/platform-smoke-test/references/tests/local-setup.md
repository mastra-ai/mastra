# Local Project Setup for Gateway Testing

## Purpose

Set up a dedicated local Mastra project to test Local + Gateway OM interactions (Test 8).

**Important:** Create a fresh project for this test. Do not reuse projects from other test suites.

## Create Project

### 1. Create Project (Non-Interactive)

```bash
mkdir -p ~/mastra-smoke-tests
cd ~/mastra-smoke-tests
pnpm create mastra@latest gateway-om-test -c agents,tools -l openai -e
cd gateway-om-test
pnpm install
```

| Flag              | Purpose                                           |
| ----------------- | ------------------------------------------------- |
| `-c agents,tools` | Include agents and tools                          |
| `-l openai`       | Set OpenAI as provider (skips interactive prompt) |
| `-e`              | Include example code                              |

## Add Test Agents

Add these agents to test different Memory configurations.

### 1. Memory-Only Agent (no OM)

Create `src/mastra/agents/memory-agent.ts`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

export const memoryAgent = new Agent({
  name: 'memory-agent',
  instructions: 'You are a helpful assistant. Keep track of our conversation.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
  },
  memory: new Memory(),
});
```

### 2. OM-Enabled Agent

Create `src/mastra/agents/om-agent.ts`:

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

export const omAgent = new Agent({
  name: 'om-agent',
  instructions: 'You are a helpful assistant with observational memory.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
  },
  memory: new Memory({
    options: {
      observationalMemory: {
        enabled: true,
      },
    },
  }),
});
```

### 3. Register Agents

Update `src/mastra/index.ts`:

```typescript
import { Mastra } from '@mastra/core/mastra';
import { memoryAgent } from './agents/memory-agent';
import { omAgent } from './agents/om-agent';
// Keep any existing agents too

export const mastra = new Mastra({
  agents: {
    memoryAgent,
    omAgent,
    // ...existing agents
  },
});
```

### 4. Install Memory Package (if not present)

```bash
pnpm add @mastra/memory
```

---

## Configure Gateway Routing

Set up the project to route requests through the Gateway.

### 1. Set Environment Variables

Add to `.env`:

```bash
# Route OpenAI requests through Gateway
OPENAI_API_KEY=msk_your_gateway_api_key
OPENAI_BASE_URL=https://server.mastra.ai/v1

# For staging, use:
# OPENAI_BASE_URL=https://server.staging.mastra.ai/v1
```

**Important:** Use your Gateway API key (starts with `msk_`), not an OpenAI key.

### 2. Verify TypeScript Compiles

```bash
pnpm tsc --noEmit
```

### 3. Start Dev Server

```bash
pnpm dev
```

The local Studio should be available at `http://localhost:4111`.

---

## Verification Checklist

Before proceeding to Test 8 scenarios:

- [ ] Project exists and has dependencies installed
- [ ] `memory-agent` is registered and visible in Studio
- [ ] `om-agent` is registered and visible in Studio
- [ ] `.env` has Gateway API key and base URL
- [ ] `pnpm dev` starts without errors
- [ ] Studio loads at `http://localhost:4111`

---

## Common Issues

| Issue                      | Cause                      | Fix                                   |
| -------------------------- | -------------------------- | ------------------------------------- |
| Interactive prompt appears | Missing `-l` flag          | Use `-l openai`                       |
| Memory import fails        | Package not installed      | `pnpm add @mastra/memory`             |
| Agent not in Studio        | Not registered in index.ts | Add to `agents` object                |
| TypeScript errors          | Type mismatch              | Run `pnpm tsc --noEmit` to see errors |
| Gateway 401                | Wrong API key              | Use `msk_` key, not `sk-`             |
