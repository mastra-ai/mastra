# Mastra Observability

A comprehensive observability system for AI operations in Mastra, providing type-safe span tracking, event-driven exports, and flexible tracing configuration.

## Overview

The Mastra Observability system enables detailed observability for AI-driven applications by tracking operations through spans that capture metadata, timing, and context. It's designed to work seamlessly with Mastra's architecture while providing flexible configuration and export options.

## Key Features

- **Type-Safe Spans**: Strongly typed metadata based on span type prevents runtime errors
- **Event-Driven Architecture**: Real-time tracing events for immediate observability
- **OpenTelemetry Compatible**: Uses standard trace and span ID formats for integration
- **Flexible Sampling**: Multiple sampling strategies with custom sampler support
- **Pluggable Processors**: Modify or filter span fields before export
- **Pluggable Exporters**: Multiple export formats and destinations
- **Automatic Lifecycle Management**: Spans automatically emit events without manual intervention

## Quick Start

### Manual Tracing

```typescript
import { DefaultObservabilityInstance, SpanType } from '@mastra/observability';

// Create observability instance
const observability = new DefaultObservabilityInstance({
  name: 'my-app',
  serviceName: 'my-app',
});

// Start an agent span
const agentSpan = observability.startSpan({
  type: SpanType.AGENT_RUN,
  name: 'customer-support-agent',
  attributes: {
    agentId: 'agent-123',
    instructions: 'Help with customer support',
    maxSteps: 10,
  },
});

// Create child spans for nested operations
const llmSpan = agentSpan.createChildSpan({
  type: SpanType.MODEL_GENERATION,
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

### Span Types

- **`WORKFLOW_RUN`**: Root span for entire workflow execution
- **`WORKFLOW_STEP`**: Individual step execution within a workflow
- **`AGENT_RUN`**: Agent processing (supports tools, memory, multi-step)
- **`MODEL_GENERATION`**: Individual model API calls with token usage
- **`TOOL_CALL`**: Function/tool execution
- **`MCP_TOOL_CALL`**: Model Context Protocol tool execution
- **`PROCESSOR_RUN`**: Input/output processor execution
- **`GENERIC`**: Custom spans for other operations

### Basic Configuration

Enable observability in your Mastra instance:

```typescript
import { Mastra } from '@mastra/core';
import { Observability } from '@mastra/observability';

export const mastra = new Mastra({
  // ... other config
  observability: new Observability({
    default: { enabled: true },
  }),
});
```

This enables the `DefaultExporter` and `CloudExporter`, with the `SensitiveDataFilter` span output processor, and `always` sampling.

## Performance Considerations

### Current Implementation

The current implementation prioritizes correctness and ease of use:

- **Automatic Lifecycle Management**: All spans automatically emit events through method wrapping
- **Real-time Export**: Events are exported immediately when they occur
- **Memory Overhead**: Each span maintains references to tracing instance
