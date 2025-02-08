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
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'Your task-specific instructions',
  model: openai('gpt-4o-mini'),
  tools: {}, // Optional tools
});
```

[More agent documentation →](https://mastra.ai/docs/reference/agents/overview)

### Embeddings (`/embeddings`)

The embeddings module provides a unified interface for converting text into vector representations across multiple AI providers. These vectors are essential for semantic search, similarity comparisons, and other NLP tasks.

```typescript
import { openai } from '@ai-sdk/openai';
import { embed } from 'ai';

const embeddings = await embed({
  model: openai.embedding('text-embedding-3-small'),
  value: 'text to embed',
});
```

Supported providers right now are OpenAI, Cohere, Amazon Bedrock, Google AI, Mistral, and Voyage.

[More embeddings documentation →](https://mastra.ai/docs/reference/embeddings/overview)

### Evaluations (`/eval`)

The evaluation system enables quantitative assessment of AI outputs. Create custom metrics to measure specific aspects of AI performance, from response quality to task completion accuracy.

```typescript
import { Metric, evaluate } from '@mastra/core';

class CustomMetric extends Metric {
  async measure(input: string, output: string): Promise<MetricResult> {
    // Your evaluation logic
    return { score: 0.95 };
  }
}
```

[More evaluations documentation →](https://mastra.ai/docs/reference/eval/overview)

### Memory (`/memory`)

Memory management provides persistent storage and retrieval of AI interactions. It supports different storage backends and enables context-aware conversations and long-term learning.

```typescript
import { MastraMemory } from '@mastra/core';

const memory = new MastraMemory({
  // Memory configuration
});
```

**Note:** this is the base `MastraMemory` class. This class in `@mastra/core` is intended to be extended when developing custom agent memory strategies.
To use a premade memory strategy (recommended), with long and short term memory built in, use `import { Memory } from "@mastra/memory"` instead.

[Visit the memory documentation to use Memory in your project →](https://mastra.ai/docs/reference/memory/overview)

### Vector Stores (`/vector`)

Vector stores provide the infrastructure for storing and querying vector embeddings. They support semantic search, similarity matching, and efficient vector operations across different backend implementations.

```typescript
import { MastraVector } from '@mastra/core';

class CustomVectorStore extends MastraVector {
  // Vector store implementation
}
```

[More vector stores documentation →](https://mastra.ai/docs/reference/vector/overview)

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

[More workflows documentation →](https://mastra.ai/docs/reference/workflows/overview)

### Tools (`/tools`)

Tools are functions that agents can use to interact with external systems or perform specific tasks. Each tool has a clear description and schema, making it easy for AI to understand and use them effectively.

```typescript
import { ToolAction } from '@mastra/core';

const tool = new ToolAction({
  name: 'tool-name',
  description: 'Tool description',
  execute: async context => {
    // Tool implementation
  },
});
```

[More tools documentation →](https://mastra.ai/docs/reference/tools/overview)

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

Telemetry provides OpenTelemetry integration for comprehensive monitoring of your AI systems. Track latency, success rates, and system health with distributed tracing and metrics collection.

```typescript
import { Telemetry } from '@mastra/core';

const telemetry = Telemetry.init({
  serviceName: 'my-service',
});
```

[More Telemetry documentation →](https://mastra.ai/docs/reference/observability/telemetry)

## Additional Resources

- [Getting Started Guide](https://mastra.ai/docs/getting-started/installation)
- [API Reference](https://mastra.ai/docs/reference)
- [Examples](https://mastra.ai/docs/examples)
- [Deployment Guide](https://mastra.ai/docs/deployment/overview)
