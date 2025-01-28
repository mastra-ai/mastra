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

## Core Components

### Actions (`/action`)

Actions are the fundamental building blocks of Mastra workflows. They represent discrete, executable tasks with well-defined inputs and outputs. Each action can validate its inputs using Zod schemas and can access Mastra's core services through the execution context.

```typescript
interface IAction<TId, TSchemaIn, TSchemaOut, TContext> {
  id: TId;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute: (context: TContext) => Promise<TSchemaOut>;
}
```

### Agents (`/agent`)

Agents are autonomous AI entities that can understand instructions, use tools, and complete tasks. They encapsulate LLM interactions and can maintain conversation history, use provided tools, and follow specific behavioral guidelines through instructions.

```typescript
import { Agent } from '@mastra/core';

const agent = new Agent({
  name: 'my-agent',
  instructions: 'Your task-specific instructions',
  model: {
    provider: 'openai',
    model: 'gpt-4',
  },
  tools: {}, // Optional tools
});
```

### Embeddings (`/embeddings`)

The embeddings module provides a unified interface for converting text into vector representations across multiple AI providers. These vectors are essential for semantic search, similarity comparisons, and other NLP tasks.

```typescript
import { embed, EmbeddingOptions } from '@mastra/core';

const embeddings = await embed('text to embed', {
  provider: 'OPEN_AI',
  model: 'text-embedding-ada-002',
});
```

Supported providers:

- OpenAI: State-of-the-art embeddings
- Cohere: Multilingual support
- Amazon Bedrock: Enterprise-grade embeddings
- Google AI: PaLM-based embeddings
- Mistral: Open-source alternative
- Voyage: Specialized embeddings

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

### Hooks (`/hooks`)

Hooks provide an event system for monitoring and extending Mastra's functionality. They allow you to react to key events in the AI pipeline, enabling logging, monitoring, and custom behavior injection.

```typescript
import { AvailableHooks, registerHook } from '@mastra/core';

registerHook(AvailableHooks.ON_GENERATION, ({ input, output, metric, runId, agentName }) => {
  // Handle generation event
});
```

Available hooks:

- `ON_EVALUATION`: Triggered after evaluation, useful for logging and analysis
- `ON_GENERATION`: Triggered after text generation, perfect for monitoring outputs

### Memory (`/memory`)

Memory management provides persistent storage and retrieval of AI interactions. It supports different storage backends and enables context-aware conversations and long-term learning.

```typescript
import { MastraMemory } from '@mastra/core';

const memory = new MastraMemory({
  // Memory configuration
});
```

### Vector Stores (`/vector`)

Vector stores provide the infrastructure for storing and querying vector embeddings. They support semantic search, similarity matching, and efficient vector operations across different backend implementations.

```typescript
import { MastraVector } from '@mastra/core';

class CustomVectorStore extends MastraVector {
  // Vector store implementation
}
```

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

### Logger (`/logger`)

The logging system provides structured, leveled logging with multiple transport options. It supports debug information, performance monitoring, and error tracking across your AI applications.

```typescript
import { createLogger, LogLevel } from '@mastra/core';

const logger = createLogger({
  name: 'MyApp',
  level: LogLevel.INFO,
});
```

### Telemetry (`/telemetry`)

Telemetry provides OpenTelemetry integration for comprehensive monitoring of your AI systems. Track latency, success rates, and system health with distributed tracing and metrics collection.

```typescript
import { Telemetry } from '@mastra/core';

const telemetry = Telemetry.init({
  serviceName: 'my-service',
});
```
