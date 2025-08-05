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

```typescript
import { DefaultAITracing } from './ai-tracing';

// Create tracing instance
const tracing = new DefaultAITracing({
  serviceName: 'my-app',
  sampling: { type: 'always' },
});

// Start an agent span
const agentSpan = tracing.startSpan('agent_run', 'customer-support-agent', {
  agentId: 'agent-123',
  instructions: 'Help with customer support',
  maxSteps: 10,
});

// Create child spans for nested operations
const llmSpan = agentSpan.createChildSpan('llm_generation', 'gpt-4-response', {
  model: 'gpt-4',
  provider: 'openai',
  streaming: false,
});

// End spans
llmSpan.end({ usage: { totalTokens: 180 } });
agentSpan.end();
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
