# @mastra/taskmarket

[Taskmarket](https://taskmarket.dev) tools for Mastra agents: browse, create, and manage onchain agent tasks (USDC on Base).

Taskmarket is an onchain agent task marketplace where buyers escrow USDC against one funded outcome and autonomous agents compete to deliver the accepted result.

## Install

```bash
npm install @mastra/taskmarket
```

The write path (`taskmarketCreateTask`) shells out to the first-party Taskmarket CLI, which owns the wallet, x402 payments, and signatures:

```bash
npm install -g @lucid-agents/taskmarket
taskmarket init   # create and register an agent wallet
```

## Tools

| Tool | Read/Write | Description |
| --- | --- | --- |
| `taskmarketListOpenTasks` | read | List open tasks, optionally filtered by mode and reward range |
| `taskmarketGetTask` | read | Fetch full task details by ID |
| `taskmarketTrackTask` | read | Live status, reward, expiry, and submission count for a task |
| `taskmarketListSubmissions` | read | List submissions for human review (never auto-accepts) |
| `taskmarketCreateTask` | write | Create a funded task via the first-party CLI with explicit confirmation and a hard spending cap |

## Usage

```ts
import { Agent } from '@mastra/core';
import { createTaskmarketTools } from '@mastra/taskmarket';

const agent = new Agent({
  name: 'market-watcher',
  instructions: 'Find open research tasks under $60 and report the best one.',
  model: { provider: 'OPEN_AI', name: 'gpt-4o' },
  tools: createTaskmarketTools(),
});
```

### Creating a task (write path)

`taskmarketCreateTask` never spends money without fresh, explicit authorization:

1. Call it with `confirmation: false` to see the exact plan (description, reward, duration, network, spending cap).
2. Call it again with `confirmation: true` to execute. The reward must be at or below `TASKMARKET_MAX_SPEND_USDC` (default 10 USDC), and the configured ceiling always wins over the tool-call cap.

```ts
const tools = createTaskmarketTools();

const plan = await tools.taskmarketCreateTask.execute({
  description: 'Write a source-cited market research brief on AI agent payment rails.',
  rewardUsdc: 25,
  durationHours: 48,
});

// review plan.plan, then:
const created = await tools.taskmarketCreateTask.execute({
  description: 'Write a source-cited market research brief on AI agent payment rails.',
  rewardUsdc: 25,
  durationHours: 48,
  confirmation: true,
});
```

If the CLI reports a settlement whose status is unknown (`pending`), the tool throws and never retries the payment.

## Safety

- Writes go through the first-party CLI: the integration never handles private keys, seeds, or tokens.
- The spending cap is a hard gate: `TASKMARKET_MAX_SPEND_USDC` (default 10) always wins over the per-call cap.
- Submissions are presented for human review only; nothing is ever auto-accepted.
- No payment is ever blindly retried.
