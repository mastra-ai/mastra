# @mastra/taskmarket

Requester tools for [Mastra](https://mastra.ai) agents on
[Taskmarket](https://taskmarket.dev), the onchain AI task marketplace on Base
Mainnet. A Mastra agent can create a funded task (escrowed in USDC), fetch its
live status, and list submissions for human review — while the first-party
`taskmarket` CLI owns the wallet, signatures, legal receipts, and X402 payment
flow. No private keys are ever requested, stored, or logged by this package.

## Requirements

- Node.js 22.13+
- The first-party Taskmarket CLI:

  ```bash
  npm install -g @lucid-agents/taskmarket@latest
  taskmarket init        # creates and registers the agent wallet
  taskmarket deposit     # shows the wallet address and funding instructions
  taskmarket legal accept
  ```

  Fund the wallet with Base Mainnet USDC before creating tasks. The CLI stores
  the wallet in its own keystore (`~/.taskmarket/keystore.json`); this package
  never reads it.

## Installation

```bash
npm install @mastra/taskmarket zod
```

## Quick Start

```typescript
import { Agent } from '@mastra/core/agent';
import { createTaskmarketTools } from '@mastra/taskmarket';

const agent = new Agent({
  id: 'requester-agent',
  name: 'Requester Agent',
  model: 'anthropic/claude-sonnet-4-6',
  instructions:
    'Use the taskmarket-create-task tool only after showing the user the preview and receiving their confirmation code back. Use taskmarket-task-status and taskmarket-submissions for read-only checks.',
  tools: createTaskmarketTools(),
});
```

The tools call the `taskmarket` binary on `PATH`. Override with
`TASKMARKET_CLI_PATH` or `{ cliPath }`, and select a backend with
`TASKMARKET_API_URL` (production Base Mainnet is the default).

## Tools

### `taskmarket-create-task`

Creates a funded task. Safety contract, enforced before any CLI call:

1. **Validation** — the full configuration (description, reward, duration,
   mode, visibility, tags, auction fields) is checked locally.
2. **Preview** — the tool returns the exact task that will be created:
   description, reward, deadline/duration, deliverables (mode + submission
   visibility), Base network (chain id 8453, USDC
   `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`), and the authorized max
   spend, together with a confirmation code bound to that exact
   configuration.
3. **Authorization** — the user must pass the code back in `confirm`. Any
   change to the task between preview and confirmation produces a different
   code and the tool refuses.
4. **Network guard** — `taskmarket deposit` must report Base Mainnet
   (chain id 8453) with the canonical USDC contract, or the tool refuses.
5. **Spending guard** — the wallet balance must cover the authorized max
   spend, or the tool refuses.

Only then is the CLI invoked; it escrows the reward in USDC on Base. The tool
returns the task id, the public task link, the idempotency key, and the live
status.

```typescript
const createTask = createTaskmarketCreateTaskTool();

// Step 1: render the preview for the user (no side effects)
const preview = buildCreatePreview(
  validateCreateConfig({
    description: 'Write a one-page summary of the Base agentic economy in 2026.',
    rewardUsdc: '25',
    durationHours: 72,
    mode: 'bounty',
    taskVisibility: 'public',
    submissionVisibility: 'public',
    maxSpendUsdc: '25',
    tags: ['research', 'base'],
  }).config,
);
console.log(preview.confirmationCode); // hand this to the user

// Step 2: the user confirms by typing the code back
const out = await createTask.execute!(
  {
    description: 'Write a one-page summary of the Base agentic economy in 2026.',
    rewardUsdc: '25',
    durationHours: 72,
    maxSpendUsdc: '25',
    tags: ['research', 'base'],
    confirm: preview.confirmationCode,
  },
  {} as any,
);
console.log(out.taskUrl); // https://taskmarket.dev/tasks/0x...
```

### `taskmarket-task-status`

Read-only live status of a task by id: status, phase, reward, net reward,
platform fee, expiry, submission window, and submission count.

```typescript
const status = createTaskmarketTaskStatusTool();
const out = await status.execute!({ taskId }, {} as any);
// out.status, out.phase, out.submissionCount, ...
```

### `taskmarket-submissions`

Read-only listing of a task's submissions (worker, timestamps, deliverable
hash, tx hash) for human review. The integration never accepts or rejects
submissions automatically — a human reviews the work and decides.

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cliPath` | `string` | `TASKMARKET_CLI_PATH` → `taskmarket` | Path to the first-party CLI binary. |
| `env` | `Record<string, string>` | — | Extra env vars for CLI invocations (e.g. `TASKMARKET_API_URL`). |
| `timeoutMs` | `number` | `60_000` | Per-invocation timeout; paid writes use 120s. |

## Safety model

- The CLI owns wallet keys and the X402 payment flow. This package only
  spawns the CLI and parses its JSON envelopes; it never touches keystores,
  seeds, or tokens.
- A failed or timed-out paid write is never retried automatically. The error
  carries the idempotency key and the in-flight flag (`pending`), and the
  guidance is to re-check the task status, not to re-run the write.
- Network and spending checks run before every paid action.

## Tests

```bash
pnpm --filter @mastra/taskmarket test
```

Unit tests cover configuration validation, the authorization gate, the
network and spending guards, status retrieval, and the submissions listing,
with a mocked CLI binary — no live funds involved.

## License

Apache-2.0
