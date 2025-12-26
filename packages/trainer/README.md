# @mastra/trainer

Agent-level training and fine-tuning for Mastra. Train your agents using SFT (Supervised Fine-Tuning), DPO (Direct Preference Optimization), or RFT (Reinforcement Fine-Tuning) with OpenAI's fine-tuning API.

## Installation

```bash
pnpm add @mastra/trainer
```

## Usage

### Basic SFT Training from Traces

```typescript
import { Mastra } from '@mastra/core/mastra';
import { Trainer } from '@mastra/trainer';
import { OpenAIProvider } from '@mastra/trainer/providers/openai';

const mastra = new Mastra({
  agents: { myAgent },
  scorers: { quality: qualityScorer },
});

const trainer = new Trainer({
  mastra,
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
});

const result = await trainer.fitAgent(myAgent, {
  method: 'sft',
  data: {
    source: 'traces',
    filter: {
      since: new Date('2024-01-01'),
      until: new Date('2024-12-31'),
    },
  },
  scoring: {
    composite: { quality: 1.0 },
    gates: [{ scorerId: 'quality', operator: 'gte', threshold: 0.8 }],
  },
  selection: {
    minScore: 0.7,
    maxExamples: 1000,
  },
  provider: {
    baseModel: 'gpt-4o-mini-2024-07-18',
    hyperparams: {
      n_epochs: 3,
    },
  },
});

console.log('Training job started:', result.jobId);
```

### DPO Training with Preference Pairs

```typescript
const result = await trainer.fitAgent(myAgent, {
  method: 'dpo',
  data: {
    source: 'traces',
    candidatesPerCase: 3, // Generate 3 responses per input
    variationConfig: {
      temperatures: [0.3, 0.7, 1.0],
    },
  },
  scoring: {
    composite: { helpfulness: 0.6, accuracy: 0.4 },
  },
  provider: {
    baseModel: 'gpt-4o-mini-2024-07-18',
  },
});
```

### RFT Training with Graders

```typescript
const result = await trainer.fitAgent(myAgent, {
  method: 'rft',
  data: {
    source: 'dataset',
    cases: trainingCases,
  },
  scoring: {
    composite: { quality: 1.0 },
  },
  provider: {
    baseModel: 'o1-mini',
    grader: {
      type: 'scorer',
      scorerId: 'quality',
    },
  },
});
```

## Training Methods

### SFT (Supervised Fine-Tuning)

Uses high-quality examples to fine-tune the model. Best for:

- Teaching specific response formats
- Domain adaptation
- Style transfer

### DPO (Direct Preference Optimization)

Uses preference pairs (chosen vs rejected) to align model behavior. Best for:

- Improving response quality
- Reducing harmful outputs
- Learning preferences

### RFT (Reinforcement Fine-Tuning)

Uses reward signals to iteratively improve the model. Best for:

- Complex reasoning tasks
- Multi-step optimization
- Tasks with clear success metrics

## API Reference

See the [Mastra documentation](https://mastra.ai/docs/trainer/overview) for complete API reference.

## License

Apache-2.0
