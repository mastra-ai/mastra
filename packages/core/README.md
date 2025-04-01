# @mastra/core

The core foundation of the Mastra framework, providing essential components and interfaces for building AI-powered applications.

## Installation

```bash
npm install @mastra/core
```

## Overview

`@mastra/core` is the foundational package of the Mastra framework, providing:

- Core abstractions and interfaces
- AI agent management and execution
- Integration with multiple AI providers
- Workflow orchestration
- Memory and vector store management
- Telemetry and logging infrastructure
- Text-to-speech capabilities

For comprehensive documentation, visit our [official documentation](https://mastra.ai/docs).

## Core Components

### Agents (`/agent`)

Agents are autonomous AI entities that can understand instructions, use tools, and complete tasks. They encapsulate LLM interactions and can maintain conversation history, use provided tools, and follow specific behavioral guidelines through instructions.

```typescript
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'Your task-specific instructions',
  model: openai('gpt-4o-mini'),
  tools: {}, // Optional tools
});
```

[Agent documentation →](https://mastra.ai/docs/agents/00-overview)

### Workflows (`/workflows`)

Workflows orchestrate complex AI tasks by combining multiple actions into a coherent sequence. They handle state management, error recovery, and can include conditional logic and parallel execution.

```typescript
import { Workflow } from '@mastra/core';

const workflow = new Workflow({
  name: 'my-workflow',
  steps: [
    // Workflow steps
  ],
});
```

[Workflow documentation →](https://mastra.ai/docs/workflows/00-overview)

### Memory (`/memory`)

Memory management provides persistent storage and retrieval of AI interactions. It supports different storage backends and enables context-aware conversations and long-term learning.

```typescript
import { Memory } from '@mastra/memory';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

const agent = new Agent({
  name: 'Project Manager',
  instructions: 'You are a project manager assistant.',
  model: openai('gpt-4o-mini'),
  memory: new Memory({
    options: {
      lastMessages: 20,
      semanticRecall: {
        topK: 3,
        messageRange: { before: 2, after: 1 },
      },
    },
  }),
});
```

[Memory documentation →](https://mastra.ai/docs/reference/memory/Memory)

### Tools (`/tools`)

Tools are functions that agents can use to interact with external systems or perform specific tasks. Each tool has a clear description and schema, making it easy for AI to understand and use them effectively.

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const weatherInfo = createTool({
  id: 'Get Weather Information',
  inputSchema: z.object({
    city: z.string(),
  }),
  description: 'Fetches the current weather information for a given city',
  execute: async ({ context: { city } }) => {
    // Tool implementation
  },
});
```

[Tools documentation →](https://mastra.ai/docs/agents/02-adding-tools)

### Evals (`/eval`)

The evaluation system enables quantitative assessment of AI outputs. Create custom metrics to measure specific aspects of AI performance, from response quality to task completion accuracy.

```typescript
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { SummarizationMetric } from '@mastra/evals/llm';
import { ContentSimilarityMetric, ToneConsistencyMetric } from '@mastra/evals/nlp';

const model = openai('gpt-4o');

const agent = new Agent({
  name: 'ContentWriter',
  instructions: 'You are a content writer that creates accurate summaries',
  model,
  evals: {
    summarization: new SummarizationMetric(model),
    contentSimilarity: new ContentSimilarityMetric(),
    tone: new ToneConsistencyMetric()
  }
});
```

[More evals documentation →](https://mastra.ai/docs/evals/00-overview)

### Logger (`/logger`)

The logging system provides structured, leveled logging with multiple transport options. It supports debug information, performance monitoring, and error tracking across your AI applications.

```typescript
import { createLogger, LogLevel } from '@mastra/core';

const logger = createLogger({
  name: 'MyApp',
  level: LogLevel.INFO,
});
```

[More logging documentation →](https://mastra.ai/docs/reference/observability/logging)

### Telemetry (`/telemetry`)

Telemetry provides OpenTelemetry (Otel) integration for comprehensive monitoring of your AI systems. Track latency, success rates, and system health with distributed tracing and metrics collection.

```typescript
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  telemetry: {
    serviceName: 'my-service',
    enabled: true,
    sampling: {
      type: 'ratio',
      probability: 0.5,
    },
    export: {
      type: 'otlp',
      endpoint: 'https://otel-collector.example.com/v1/traces',
    },
  },
});
```

[More Telemetry documentation →](https://mastra.ai/docs/reference/observability/telemetry)

## Additional Resources

- [Getting Started Guide](https://mastra.ai/docs/getting-started/installation)
- [API Reference](https://mastra.ai/docs/reference)
- [Examples](https://mastra.ai/docs/examples)
- [Deployment Guide](https://mastra.ai/docs/deployment/overview)
