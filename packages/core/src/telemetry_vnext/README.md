# Mastra Telemetry V-Next

The next-generation telemetry system for Mastra, designed to address the limitations of the current implementation while incorporating best practices from leading AI observability platforms (Langfuse, Braintrust, OpenLLMetry).

## Architecture Overview

### Design Principles

- **Event-driven architecture** - All telemetry data flows through standardized `TelemetryEvent` types
- **Separation of concerns** - Base class handles instrumentation, exporters handle delivery optimization
- **Registry pattern** - Multiple telemetry instances instead of global singleton
- **AI-specific span types** - Comprehensive coverage for agents, workflows, LLM calls, tools, memory, RAG
- **OpenTelemetry compatibility** - Following semantic conventions and standards
- **Mastra integration** - Extends `MastraBase`, supports capability detection, follows dependency injection patterns

### Core Components

1. **Abstract Base Class (`MastraAITelemetry`)**
   - Extends `MastraBase` for consistent logging and component registration
   - Handles span lifecycle management and event emission
   - Processes spans through pluggable processors
   - Emits events to exporters (no batching logic in base class)

2. **Registry System (`TelemetryRegistry`)**
   - Replaces singleton pattern with multi-instance registry
   - Supports named telemetry instances with default fallback
   - Enables per-tenant or per-component telemetry isolation

3. **Type System (`types.ts`)**
   - AI-specific span types and metadata interfaces
   - Event-driven architecture with `TelemetryEvent` union
   - Configuration and capability detection interfaces

4. **Decorator System (`decorators.ts`)**
   - Generic `@withSpan` decorator accepting span type and attributes
   - `@InstrumentClass` for automatic method instrumentation
   - Integration with registry for dependency resolution

## Supported AI Operations

### Span Types

The system supports comprehensive AI-specific span types:

- **`AGENT_RUN`** - Agent execution with tools, memory, and decision making
- **`WORKFLOW_RUN`** - Workflow execution with step management and suspend/resume
- **`WORKFLOW_STEP`** - Individual workflow step execution
- **`LLM_GENERATION`** - Model calls with token usage, prompts, completions, streaming
- **`TOOL_CALL`** - Function/tool execution with inputs, outputs, errors
- **`MCP_TOOL_CALL`** - Model Context Protocol tool execution
- **`MEMORY_LOOKUP`** - Memory retrieval with queries, results, similarity scores
- **`MEMORY_UPDATE`** - Memory storage operations
- **`RAG_QUERY`** - Vector search with embeddings, chunks, relevance scores
- **`EMBEDDING_GENERATION`** - Document and query embedding generation
- **`EVAL_EXECUTION`** - Evaluation framework execution

### Metadata and Context

Each span type includes rich, AI-specific metadata:

```typescript
// LLM Generation example
interface LLMGenerationMetadata {
  model: string;
  provider: string;
  resultType?: 'tool_selection' | 'response_generation' | 'reasoning';
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    promptCacheHitTokens?: number;
  };
  parameters?: {
    temperature?: number;
    maxTokens?: number;
  };
  streaming?: boolean;
  timeToFirstToken?: number;
}
```

## Usage

### Basic Setup

TBD... use the default tracing implementation. Coming soon.

### Decorator Usage

```typescript
import { withSpan, InstrumentClass, SpanType } from '@mastra/core/telemetry_vnext';

// Method-level instrumentation
class AgentService {
  @withSpan({
    spanType: SpanType.LLM_GENERATION,
    attributes: { 'ai.model.name': 'gpt-4' },
  })
  async generateResponse(prompt: string) {
    // Implementation
  }
}

// Class-level instrumentation
@InstrumentClass({
  prefix: 'workflow',
  spanType: SpanType.WORKFLOW_STEP,
})
class WorkflowEngine {
  // All methods automatically traced
}
```

### Event-Driven Export

```typescript
// Exporters receive events and decide how to handle them
class MyExporter implements TelemetryExporter {
  name = 'my-exporter';

  async exportEvent(event: TelemetryEvent): Promise<void> {
    switch (event.type) {
      case 'span_ended':
        // Handle completed span
        break;
      case 'trace_ended':
        // Handle completed trace
        break;
    }
  }

  async shutdown(): Promise<void> {
    // Cleanup
  }
}
```

## Key Features

### 1. Event-Driven Architecture

All telemetry data flows as events:

```typescript
type TelemetryEvent =
  | { type: 'trace_started'; trace: Trace }
  | { type: 'trace_ended'; trace: Trace }
  | { type: 'span_started'; span: AISpan }
  | { type: 'span_ended'; span: AISpan };
```

### 2. Flexible Export Strategy

Exporters control their own batching and delivery optimization:

- **Console Exporter**: Immediate output for development
- **HTTP API Exporter**: Batch requests with retry logic
- **File Exporter**: Buffer writes and compression
- **Storage Exporter**: Database persistence with transactions

### 3. Context Propagation

Built-in support for OpenTelemetry context patterns:

- Parent-child span relationships
- Trace context propagation
- Baggage for cross-cutting concerns
- Distributed tracing compatibility

## Configuration

### Telemetry Configuration

```typescript
interface TelemetryConfig {
  serviceName?: string;
  enabled?: boolean;
  sampling?: SamplingStrategy;
  context?: {
    includeIO?: boolean;
    maxDataSize?: number;
    excludeFields?: string[];
  };
}
```

### Sampling Strategies

```typescript
type SamplingStrategy =
  | { type: 'always_on' }
  | { type: 'always_off' }
  | { type: 'ratio'; probability: number }
  | { type: 'custom'; sampler: (traceContext: any) => boolean };
```

## Improvements Over Current System

### Addressed Limitations

1. **Global Singleton Pattern** → **Registry Pattern**
   - Multi-tenant support
   - Test isolation
   - Configuration flexibility

2. **Unbounded Memory** → **Exporter Responsibility**
   - Exporters handle their own batching and memory management
   - Base class focuses on instrumentation only

3. **Limited Error Handling** → **Comprehensive Error Support**
   - Configurable retry mechanisms
   - Graceful degradation patterns
   - Structured error metadata in spans

4. **Basic Sampling** → **Flexible Sampling Strategies**
   - Custom sampling functions
   - Trace-level and span-level sampling
   - Runtime sampling decisions

5. **Performance Issues** → **Optimized Design**
   - Processing pipeline with configurable processors
   - Lazy evaluation of span attributes
   - Event-driven architecture reduces overhead

### Industry Best Practices

Incorporates patterns from leading AI observability platforms:

- **Langfuse**: Rich metadata, hierarchical observations, production-ready error handling
- **Braintrust**: Distributed tracing, comprehensive metadata
- **OpenLLMetry**: OpenTelemetry compatibility, semantic conventions, context propagation

## Outstanding Implementation Items

### 1. Abstract Method Implementation Gap

**Issue**: Base class defines abstract methods but no reference implementation exists.

**Impact**: Makes it harder for implementers to understand expected behavior.

**Recommendation**:

- Provide detailed JSDoc documentation for abstract methods
- Create reference implementation in `implementations/` directory
- Add integration tests showing expected behavior

### 2. Context Propagation

**Issue**: No clear mechanism for async context management.

**Impact**: Parent-child relationships may be lost across async boundaries.

**Missing Components**:

- AsyncLocalStorage integration for Node.js
- Context propagation across await boundaries
- Current span/trace context maintenance

**Recommendation**:

- Implement OpenTelemetry-compatible context API
- Add async context propagation helpers
- Provide context management utilities

### 3. OpenTelemetry Integration

**Issue**: Claims compatibility but lacks concrete integration.

**Impact**: Difficult to integrate with existing OTel instrumentations.

**Missing Components**:

- Mapping between AI span types and OTel semantic conventions
- Context propagation compatibility
- Interoperability with OTel SDKs

**Recommendation**:

- Define AI semantic conventions mapping
- Implement OTel context bridge
- Add integration examples

### 4. Integration with Existing Mastra

**Issue**: No migration path from current telemetry system.

**Impact**: Breaking changes for existing users.

**Consideration Points**:

- Backwards compatibility requirements
- Migration strategy documentation
- Deprecation timeline for current system

**Recommendation**:

- Design compatibility layer
- Create migration guide
- Implement feature flags for gradual adoption

### 5. Error Handling Pattern

**Issue**: Spans can have error metadata but no standardized error capture.

**Impact**: Inconsistent error reporting across implementations.

**Missing Components**:

- Automatic exception capture in traced methods
- Error propagation through span hierarchies
- Structured error reporting standards

**Recommendation**:

- Implement automatic error capture decorators
- Define error metadata standards
- Add error correlation across spans

## Next Steps

1. **Implement Reference Implementation** - Helps with adoption and testing
2. **Design Context Propagation** - Essential for distributed tracing
3. **Create Migration Strategy** - Important for existing users
4. **Add OpenTelemetry Bridge** - Enables ecosystem integration
5. **Define Error Handling Patterns** - Ensures consistency

## File Structure

```
telemetry_vnext/
├── README.md              # This documentation
├── types.ts               # Type definitions and interfaces
├── base.ts                # Abstract base class
├── registry.ts            # Multi-instance registry system
├── decorators.ts          # Instrumentation decorators
└── index.ts               # Public exports
```

## Related Documentation

- [Current Telemetry Analysis](../../TELEMETRY.md) - Comprehensive analysis of current system limitations
- [Storage System](../storage/README.md) - Similar abstract base class pattern
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/) - Industry standards for telemetry data
