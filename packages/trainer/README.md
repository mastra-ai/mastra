# @mastra/trainer

Agent-level training and fine-tuning for Mastra. Train your agents using **SFT (Supervised Fine-Tuning)** or **DPO (Direct Preference Optimization)** with OpenAI's fine-tuning API.

## Installation

```bash
pnpm add @mastra/trainer
```

## Quick Start

```typescript
import { createTrainer } from '@mastra/trainer';
import { OpenAIProvider } from '@mastra/trainer/providers/openai';

const trainer = createTrainer({
  mastra,
  provider: new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }),
});

const result = await trainer.fitAgent(myAgent, {
  method: 'sft',
  data: { source: 'traces' },
  scoring: {
    composite: { 'quality-scorer': 1.0 },
    gates: [{ scorerId: 'quality-scorer', operator: 'gte', threshold: 0.7 }],
  },
  provider: { baseModel: 'gpt-4o-mini-2024-07-18' },
});

console.log(`Training started: ${result.jobId}`);
console.log(`Training examples: ${result.trainingExamples}`);
```

## How It Works

```
Your Agent Runs → Traces Stored → Scored → Selected → Fine-tuned Model
```

1. **Traces**: Your agent interactions are logged to Mastra storage
2. **Scoring**: Each trace is evaluated using your Mastra scorers
3. **Selection**: High-quality traces are selected based on your criteria
4. **Training**: Selected examples are sent to OpenAI for fine-tuning

### Using Existing Scores

If your traces already have scorer results (from automatic scoring during agent runs), the trainer will **reuse them** instead of re-running scorers:

```typescript
data: {
  source: 'traces',
  useExistingScores: true,  // Default: true - uses stored scorer results
}
```

This makes SFT training very fast when traces are pre-scored.

## Training Methods

### SFT (Supervised Fine-Tuning)

**"Learn to do this"** - Train the model to reproduce high-quality responses.

```typescript
const result = await trainer.fitAgent(myAgent, {
  method: 'sft',
  data: {
    source: 'traces',
    filter: {
      agentName: 'My Agent',
      since: new Date('2024-01-01'),
      limit: 100,
    },
    useOriginalOutputs: true, // Use original trace responses (default)
    useExistingScores: true, // Use stored scorer results (default)
  },
  scoring: {
    composite: {
      relevancy: 0.5,
      helpfulness: 0.5,
    },
    gates: [{ scorerId: 'relevancy', operator: 'gte', threshold: 0.6 }],
  },
  selection: {
    minScore: 0.7,
    maxExamples: 100,
    holdoutRatio: 0.2, // 20% for validation
  },
  provider: {
    kind: 'openai',
    baseModel: 'gpt-4o-mini-2024-07-18',
    hyperparams: { n_epochs: 3 },
  },
});
```

**Best for:**

- Teaching specific response formats or styles
- Domain adaptation
- When you have good examples to replicate

### DPO (Direct Preference Optimization)

**"Learn to prefer this over that"** - Train the model using preference pairs.

```typescript
const result = await trainer.fitAgent(myAgent, {
  method: 'dpo',
  data: {
    source: 'traces',
    candidatesPerCase: 3, // Generate 3 responses per input (default for DPO)
    variationConfig: {
      temperatures: [0.3, 0.7, 1.0], // Different temperatures for variety
    },
  },
  scoring: {
    composite: {
      helpfulness: 0.6,
      accuracy: 0.4,
    },
  },
  selection: {
    maxExamples: 50, // Max cases (each produces 1 preference pair)
  },
  provider: {
    kind: 'openai',
    baseModel: 'gpt-4o-mini-2024-07-18',
  },
});
```

**How DPO works:**

1. For each trace, generates multiple response candidates
2. Scores each candidate with your scorers
3. Pairs the best (chosen) with worst (rejected)
4. Trains model to prefer chosen over rejected

**Best for:**

- Teaching what NOT to do
- Improving nuanced behavior
- Safety alignment

## SFT vs DPO Comparison

| Aspect          | SFT                                | DPO                                |
| --------------- | ---------------------------------- | ---------------------------------- |
| Training signal | "Do this"                          | "Prefer this over that"            |
| Speed           | Fast (uses existing traces/scores) | Slower (generates candidates)      |
| API calls       | ~0 if pre-scored                   | 3N generations + 3N scorings       |
| Data format     | Input → Output                     | Input → Preferred vs Non-preferred |
| Best for        | Replicating good examples          | Avoiding bad patterns              |

## Configuration Reference

### Data Sources

```typescript
// From traces (recommended)
data: {
  source: 'traces',
  filter: {
    agentName: 'My Agent',
    since: new Date(),
    until: new Date(),
    limit: 100,
    tags: ['production'],
    metadata: { category: 'support' },
  },
  useOriginalOutputs: true,  // Don't regenerate responses
  useExistingScores: true,   // Use stored scorer results
}

// From array (for custom datasets)
data: {
  source: 'dataset',
  cases: [
    { id: '1', messages: [...] },
    { id: '2', messages: [...] },
  ],
}
```

### Scoring Configuration

```typescript
scoring: {
  // Weighted composite score
  composite: {
    'scorer-id-1': 0.5,  // 50% weight
    'scorer-id-2': 0.3,  // 30% weight
    'scorer-id-3': 0.2,  // 20% weight
  },
  // Hard requirements (must pass ALL to be included)
  gates: [
    { scorerId: 'scorer-id-1', operator: 'gte', threshold: 0.6 },
    { scorerId: 'toxicity', operator: 'lte', threshold: 0.1 },
  ],
}
```

### Selection Configuration

```typescript
selection: {
  minScore: 0.7,        // Minimum composite score
  maxExamples: 100,     // Maximum training examples
  holdoutRatio: 0.2,    // Fraction for validation (0-1)
  dedupe: true,         // Remove duplicate inputs (SFT only)
}
```

## Job Management

```typescript
// Wait for completion
const completedJob = await trainer.waitForJob(result.jobId, job => {
  console.log(`Status: ${job.status}`);
});

// List all jobs
const jobs = await trainer.listJobs();

// Get specific job
const job = await trainer.getJob(jobId);

// Cancel a job
await trainer.cancelJob(jobId);
```

## Result

```typescript
const result = await trainer.fitAgent(agent, config);

// result contains:
{
  jobId: 'ftjob-abc123',
  status: 'pending' | 'running' | 'succeeded' | 'failed',
  trainingExamples: 50,      // Number of training examples
  validationExamples: 10,    // Number of validation examples
  artifacts: {
    trainingFile: 'file-xxx',
    validationFile: 'file-yyy',
  },
}

// After completion:
{
  fineTunedModelId: 'ft:gpt-4o-mini:org::id',
  metrics: {
    trainingLoss: 0.5,
    validationLoss: 0.6,
    trainedTokens: 50000,
  },
}
```

## License

Apache-2.0
