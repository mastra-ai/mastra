# AI Tracing

A comprehensive tracing system for AI operations in Mastra, providing type-safe span tracking, event-driven exports, and OpenTelemetry-compatible tracing.

## Overview

The AI Tracing system enables detailed observability for AI-driven applications by tracking operations through spans that capture metadata, timing, and context. It's designed to work seamlessly with Mastra's architecture while providing flexible configuration and export options.

## Key Features

- **Type-Safe Spans**: Strongly typed metadata based on span type prevents runtime errors
- **Event-Driven Architecture**: Real-time tracing events for immediate observability
- **OpenTelemetry Compatible**: Uses standard trace and span ID formats for integration
- **Flexible Sampling**: Multiple sampling strategies with custom sampler support
- **Configurable Security**: Customizable sensitive field filtering with case-insensitive matching
- **Pluggable Exporters**: Multiple export formats and destinations
- **Automatic Lifecycle Management**: Spans automatically emit events without manual intervention

## Quick Start

### Manual Tracing

```typescript
import { DefaultAITracing, AISpanType } from '@mastra/core/ai-tracing';

// Create tracing instance
const tracing = new DefaultAITracing({
  serviceName: 'my-app',
});

// Start an agent span
const agentSpan = tracing.startSpan({
  type: AISpanType.AGENT_RUN,
  name: 'customer-support-agent',
  attributes: {
    agentId: 'agent-123',
    instructions: 'Help with customer support',
    maxSteps: 10,
  },
});

// Create child spans for nested operations
const llmSpan = agentSpan.createChildSpan({
  type: AISpanType.LLM_GENERATION,
  name: 'gpt-4-response',
  attributes: {
    model: 'gpt-4',
    provider: 'openai',
    streaming: false,
  },
});

// End spans with results
llmSpan.end({
  output: 'Generated response',
  attributes: { usage: { totalTokens: 180 } },
});
agentSpan.end();
```

### Automatic Workflow Integration

The AI tracing system automatically creates span hierarchies for workflow executions:

```typescript
import { createStep } from '@mastra/core/workflows';

// Workflow step with automatic tracing
const step = createStep({
  id: 'customer-response',
  execute: async ({ inputData, mastra, aiTracingContext }) => {
    // aiTracingContext is automatically provided by the workflow engine
    const agent = mastra.getAgent('support-agent');

    // Agent calls automatically create child spans under the step span
    const response = await agent.generate(inputData.query, {
      aiTracingContext, // Pass context for automatic span threading
    });

    return { response: response.text };
  },
});
```

This creates the span hierarchy:

```
Workflow Run
├── Step: customer-response
    ├── Agent Run: support-agent
        ├── LLM Generation: model-call-1
        └── LLM Generation: model-call-2
```

### Span Types

- **`WORKFLOW_RUN`**: Root span for entire workflow execution
- **`WORKFLOW_STEP`**: Individual step execution within a workflow
- **`AGENT_RUN`**: Agent processing (supports tools, memory, multi-step)
- **`LLM_GENERATION`**: Individual LLM API calls with token usage
- **`TOOL_CALL`**: Function/tool execution
- **`MCP_TOOL_CALL`**: Model Context Protocol tool execution
- **`GENERIC`**: Custom spans for other operations

### Configuration

Register AI tracing with your Mastra instance:

```typescript
import { registerAITracing, DefaultAITracing } from '@mastra/core';

// Register a tracing instance
const tracing = new DefaultAITracing({
  serviceName: 'my-app',
  sampling: { type: 'always' },
});

registerAITracing('default', tracing, true); // true = set as default
```

## Performance Considerations

### Current Implementation

The current implementation prioritizes correctness and ease of use:

- **Automatic Lifecycle Management**: All spans automatically emit events through method wrapping
- **Real-time Export**: Events are exported immediately when they occur
- **Memory Overhead**: Each span maintains references to tracing instance and root trace span

### Future Optimization Opportunities

When performance becomes a concern, consider these optimizations:

1. **Batched Exports**: Implement export queues for high-throughput scenarios
2. **Sampling at Creation**: Move sampling decision earlier to avoid creating unnecessary spans
3. **Async Export Queues**: Buffer events and export in batches to reduce I/O overhead
