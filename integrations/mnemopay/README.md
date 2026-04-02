# @mastra/mnemopay

MnemoPay integration for [Mastra](https://mastra.ai) — give your AI agents **economic memory**.

Agents that use MnemoPay remember payment outcomes, learn from settlements and refunds, and build a reputation score over time. This is the missing piece for commerce agents: instead of treating every transaction as a blank slate, the agent accumulates experience and makes better decisions.

## Installation

```bash
pnpm add @mastra/mnemopay @mnemopay/sdk
```

## Quick Start

```typescript
import { MnemoPayLite } from '@mnemopay/sdk';
import { createMnemoPayTools } from '@mastra/mnemopay';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// 1. Create a MnemoPay agent with a reputation step of 0.05
const mnemo = new MnemoPayLite('commerce-agent', 0.05);

// 2. Generate all Mastra tools
const tools = createMnemoPayTools({ agent: mnemo });

// 3. Wire them into a Mastra agent
const agent = new Agent({
  name: 'Commerce Agent',
  model: openai('gpt-4o'),
  instructions: `You are a commerce agent with economic memory.
    Before paying a provider, recall past experiences.
    After a successful delivery, settle the transaction.
    If quality is poor, refund and remember why.`,
  tools,
});
```

## Available Tools

| Tool | Description |
|------|-------------|
| `mnemopay_remember` | Store an observation in economic memory (e.g. "Provider X delivered on time") |
| `mnemopay_recall` | Search memories by natural language query before making decisions |
| `mnemopay_charge` | Initiate a pending payment transaction |
| `mnemopay_settle` | Confirm a transaction went well (reputation +step) |
| `mnemopay_refund` | Reverse a transaction (reputation -step) |
| `mnemopay_balance` | Check wallet balance and reputation score |
| `mnemopay_profile` | Get full agent profile with summary statistics |

## Use Cases

### MedusaJS Commerce Agent

Pair this integration with a MedusaJS storefront to build an agent that:

- Recalls which suppliers have the best track record before placing orders
- Automatically settles payments when delivery is confirmed
- Refunds and remembers when products arrive damaged
- Builds a supplier reputation database through lived experience

### Multi-Agent Marketplace

Multiple Mastra agents can each maintain their own MnemoPay instance, creating a marketplace where agents have individual reputations and memories — enabling trust-based commerce between autonomous agents.

## Individual Tool Factories

If you only need specific tools, import them individually:

```typescript
import { createChargeTool, createSettleTool } from '@mastra/mnemopay';
import { MnemoPayLite } from '@mnemopay/sdk';

const mnemo = new MnemoPayLite('payments-only', 0.1);

const tools = {
  mnemopay_charge: createChargeTool(mnemo),
  mnemopay_settle: createSettleTool(mnemo),
};
```

## Events

MnemoPay emits events you can listen to outside of Mastra:

- `memory:stored` — a new memory was created
- `memory:recalled` — memories were retrieved
- `payment:completed` — a charge was settled
- `payment:refunded` — a charge was refunded
- `reputation:changed` — the agent's reputation score changed

## License

Apache-2.0
