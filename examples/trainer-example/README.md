# Mastra Trainer Example

This example demonstrates how to use **Mastra's Trainer** package to fine-tune AI agents using traces collected from real interactions.

## Overview

The example includes:

- **Customer Support Agent**: A helpful agent with tools for looking up products, orders, and customers
- **Scorers**: Evaluators for answer relevancy, tone consistency, and completeness
- **Seed Script**: Generates realistic customer support traces
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
- Store all traces in the local SQLite database (`mastra.db`)
- Show progress and results

### Step 2: Train the Agent

Once you have traces, run the training script:

```bash
pnpm train
```

This will:

1. Load traces from the database
2. Score each trace using the configured scorers
3. Filter traces based on quality gates
4. Upload training data to OpenAI
5. Start a fine-tuning job
6. Wait for completion and report the fine-tuned model ID

### List Existing Training Jobs

To see your training jobs:

```bash
npx tsx src/train.ts list
```

## How It Works

### The Training Pipeline

```
Traces → Score → Filter → Format → Upload → Fine-tune
```

1. **Traces**: Agent interactions are automatically logged to storage
2. **Score**: Each trace is evaluated using multiple scorers
3. **Filter**: Only high-quality traces pass the quality gates
4. **Format**: Traces are converted to OpenAI's training format
5. **Upload**: Training files are uploaded to OpenAI
6. **Fine-tune**: OpenAI trains a new model version

### Configuration

The training configuration in `src/train.ts` includes:

```typescript
{
  method: 'sft',  // Supervised Fine-Tuning

  data: {
    source: 'traces',
    filter: {
      agentName: 'Customer Support Agent',
      limit: 100,
    },
  },

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

  selection: {
    minScore: 0.7,
    maxExamples: 50,
    holdoutRatio: 0.2,  // 20% for validation
  },

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
├── package.json
├── tsconfig.json
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

## Training Methods

The trainer supports two methods:

- **SFT (Supervised Fine-Tuning)**: Train on high-quality examples
- **DPO (Direct Preference Optimization)**: Train on preference pairs

This example uses SFT, which is simpler and works well for most use cases.

## Troubleshooting

### "No training cases found"

Run `pnpm seed` first to generate traces.

### "OPENAI_API_KEY environment variable is required"

Set your API key: `export OPENAI_API_KEY=your-key`

### Training takes too long

OpenAI fine-tuning typically takes 10-30 minutes for small datasets. The script will poll for status updates.

## Learn More

- [Mastra Documentation](https://mastra.ai/docs)
- [OpenAI Fine-tuning Guide](https://platform.openai.com/docs/guides/fine-tuning)
