# Mastra Trainer Example

This example demonstrates how to use **Mastra's Trainer** to fine-tune AI agents using traces collected from real interactions.

## Overview

The example includes:

- **Customer Support Agent**: A helpful agent with tools for looking up products, orders, and customers
- **Scorers**: Evaluators for answer relevancy, tone consistency, and completeness
- **Seed Script**: Generates realistic customer support traces with automatic scoring
- **Training Script**: Fine-tunes the agent using OpenAI's fine-tuning API

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Set your OpenAI API key:

```bash
export OPENAI_API_KEY=your-api-key
```

## Usage

### Step 1: Generate Training Data (Seed)

Run the seed script to generate traces from realistic customer support conversations:

```bash
pnpm seed
```

This will:

- Run the support agent with ~40 different customer queries
- **Score each trace automatically** using the configured scorers
- Store all traces and scorer results in the local SQLite database (`mastra.db`)

### Step 2: Train the Agent

Once you have traces, run the training script:

```bash
pnpm train
```

This will:

1. Load traces from the database
2. **Reuse existing scorer results** (no need to re-score!)
3. Filter traces based on quality gates
4. Select the best examples
5. Upload training data to OpenAI
6. Start a fine-tuning job
7. Wait for completion and report the fine-tuned model ID

### List Existing Training Jobs

```bash
pnpm train:list
```

## How It Works

### The Training Pipeline

```
Agent Runs → Traces + Scores Stored → Load → Filter → Select → Upload → Fine-tune
                     ↑
              (scores reused!)
```

1. **Agent Runs**: Your agent handles requests, traces are logged
2. **Scoring**: Traces are scored during generation (or can be scored later)
3. **Load**: Trainer loads traces AND their existing scores from storage
4. **Filter**: Only traces passing quality gates are kept
5. **Select**: Top examples selected based on composite score
6. **Upload**: Training files uploaded to OpenAI
7. **Fine-tune**: OpenAI trains a new model version

### Key Feature: Existing Scores

When you run agents with scorers, the results are stored in the database:

```typescript
// During seeding, traces are scored automatically
const result = await agent.generate(query, {
  scorers: { relevancy, tone, completeness },
});
// → Trace + scorer results stored in DB
```

During training, these scores are **reused** instead of re-running scorers:

```typescript
data: {
  source: 'traces',
  useExistingScores: true,  // Default - uses stored scorer results
}
```

This makes training very fast!

## Training Methods

### SFT (Supervised Fine-Tuning)

Default method. Uses high-quality traces to teach the model how to respond.

```typescript
method: 'sft';
```

**Flow**: Load traces → Use existing scores → Select best → Train

### DPO (Direct Preference Optimization)

Uses preference pairs to teach what to prefer and what to avoid.

```typescript
method: 'dpo';
```

**Flow**: Load traces → Generate 3 responses per input → Score each → Pair best/worst → Train

To try DPO, change `method: 'sft'` to `method: 'dpo'` in `src/train.ts`.

**Note**: DPO is slower because it generates new responses and scores them fresh.

## Configuration

The training configuration in `src/train.ts`:

```typescript
{
  // Training method: 'sft' or 'dpo'
  method: 'sft',

  // Data source
  data: {
    source: 'traces',
    filter: {
      agentName: 'Customer Support Agent',
      limit: 100,
    },
    // These are the defaults:
    useOriginalOutputs: true,   // Use original trace responses
    useExistingScores: true,    // Reuse stored scorer results
  },

  // How to evaluate traces
  scoring: {
    composite: {
      'answer-relevancy-scorer': 0.4,  // 40% weight
      'tone-scorer': 0.3,              // 30% weight
      'completeness-scorer': 0.3,      // 30% weight
    },
    gates: [
      { scorerId: 'answer-relevancy-scorer', operator: 'gte', threshold: 0.6 },
      { scorerId: 'tone-scorer', operator: 'gte', threshold: 0.5 },
    ],
  },

  // How to select examples
  selection: {
    minScore: 0.7,       // Minimum composite score
    maxExamples: 50,     // Maximum training examples
    holdoutRatio: 0.2,   // 20% for validation
  },

  // OpenAI configuration
  provider: {
    kind: 'openai',
    baseModel: 'gpt-4o-mini-2024-07-18',
    hyperparams: { n_epochs: 3 },
  },
}
```

## Project Structure

```
trainer-example/
├── src/
│   ├── mastra/
│   │   ├── agents/
│   │   │   └── index.ts      # Customer support agent
│   │   ├── tools/
│   │   │   └── index.ts      # Product, order, customer tools
│   │   ├── scorers/
│   │   │   └── index.ts      # Quality evaluation scorers
│   │   └── index.ts          # Mastra configuration
│   ├── seed.ts               # Trace generation script
│   └── train.ts              # Training script
├── mastra.db                 # SQLite database (traces + scores)
├── package.json
└── README.md
```

## Using the Fine-tuned Model

After training completes, update your agent to use the new model:

```typescript
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Customer Support Agent',
  // Use your fine-tuned model
  model: openai('ft:gpt-4o-mini-2024-07-18:your-org::abc123'),
  // ... rest of config
});
```

## SFT vs DPO

| Aspect      | SFT                     | DPO                        |
| ----------- | ----------------------- | -------------------------- |
| Speed       | ⚡ Fast (reuses scores) | 🐢 Slower (regenerates)    |
| API calls   | ~0 (uses stored scores) | Many (3 per trace)         |
| Best for    | Good examples           | Learning preferences       |
| Data needed | High-quality traces     | Multiple response variants |

## Troubleshooting

### "No training cases found"

Run `pnpm seed` first to generate traces.

### "No examples passed selection criteria"

Your quality gates might be too strict. Try lowering thresholds:

```typescript
gates: [{ scorerId: 'answer-relevancy-scorer', operator: 'gte', threshold: 0.4 }];
```

### "OPENAI_API_KEY environment variable is required"

Set your API key: `export OPENAI_API_KEY=your-key`

### Training takes too long

OpenAI fine-tuning typically takes 10-30 minutes for small datasets. The script polls for status updates.

### DPO shows 0 examples

DPO requires multiple candidates per case. Make sure:

- `candidatesPerCase` is at least 2 (default is 3 for DPO)
- The generated responses have sufficient score differences

## Learn More

- [Mastra Documentation](https://mastra.ai/docs)
- [OpenAI Fine-tuning Guide](https://platform.openai.com/docs/guides/fine-tuning)
