# Braintrust Observability Exporter Implementation Plan

## Project Structure

```
observability/braintrust/
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── tsup.config.ts
├── vitest.config.ts
├── eslint.config.js
├── src/
│   ├── index.ts
│   ├── ai-tracing.ts
│   └── ai-tracing.test.ts
└── README.md
```

## Core Architecture

### 1. BraintrustExporter Class

- Implements `AITracingExporter` interface from `@mastra/core/ai-tracing`
- Uses `startSpan()` and `startSpanWithParents()` methods from Braintrust SDK
- Maintains internal span tracking similar to Langfuse implementation
- Supports realtime and batch modes

### 2. Key Differences from Langfuse

- **No top-level traces**: Braintrust only has spans, so root spans become top-level spans
- **Rich span types**: Map Mastra's 16 span types to Braintrust's 6 types ("llm", "score", "function", "eval", "task", "tool")
- **Flatter hierarchy**: Less nesting since no trace wrapper

## Span Type Mappings

### Mastra → Braintrust Type Mappings

Uses a default-with-exceptions approach for better maintainability:

```typescript
// Default span type for all spans
const DEFAULT_SPAN_TYPE = 'task';

// Exceptions to the default mapping
const SPAN_TYPE_EXCEPTIONS: Partial<Record<AISpanType, string>> = {
  [AISpanType.LLM_GENERATION]: 'llm',
  [AISpanType.LLM_CHUNK]: 'llm',
  [AISpanType.TOOL_CALL]: 'tool',
  [AISpanType.MCP_TOOL_CALL]: 'tool',
  [AISpanType.WORKFLOW_CONDITIONAL_EVAL]: 'function',
  [AISpanType.WORKFLOW_WAIT_EVENT]: 'function',
};

// Mapping function
function mapSpanType(spanType: AISpanType): string {
  return SPAN_TYPE_EXCEPTIONS[spanType] ?? DEFAULT_SPAN_TYPE;
}
```

**Benefits:**

- ✅ New AISpanTypes automatically default to `'task'`
- ✅ No maintenance required when adding new span types
- ✅ Clear separation of special cases vs defaults
- ✅ More maintainable and future-proof

## Event Handling Strategy

### Events as Zero-Duration Spans

Since Braintrust doesn't have a separate event concept (unlike Langfuse's `trace.event()`), events will be handled as zero-duration spans:

1. **Event Detection**: Check `span.isEvent === true`
2. **Span Creation**: Create regular Braintrust span using `startSpan()`
3. **Time Handling**: Set both `startTime` and `endTime` to the event's `startTime`
4. **Output Logging**: Log output immediately since events are instantaneous
5. **Visual Representation**: Zero-duration spans are easily identifiable in Braintrust UI

**Benefits:**

- ✅ Preserves point-in-time nature of events
- ✅ Works within Braintrust's span-only model
- ✅ Maintains hierarchical structure
- ✅ Simple implementation (no separate event logic)
- ✅ Events remain queryable and analyzable

## Configuration Interface

```typescript
interface BraintrustExporterConfig {
  apiKey: string;
  endpoint?: string; // Optional custom endpoint
  realtime?: boolean; // Flush after each event
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  tuningParameters?: Record<string, any>; // Support tuning params
}
```

## Implementation Strategy

### Phase 1: Core Infrastructure

1. Set up package structure matching Langfuse
2. Implement `BraintrustExporter` class with basic span creation
3. Handle span lifecycle (started, updated, ended)
4. **Add event handling**: Implement zero-duration span logic for `isEvent` spans

### Phase 2: Span Management

1. Implement span hierarchy tracking without traces
2. Map input/output/error fields to Braintrust span logging
3. Handle parent-child relationships using `startSpanWithParents`
4. **Event parent relationships**: Ensure events properly attach to parent spans

### Phase 3: Advanced Features

1. Implement span type mapping with proper attributes
2. Add support for tuning parameters via environment variables
3. Error handling and logging integration

### Phase 4: Testing & Documentation

1. Create comprehensive test suite following Langfuse patterns
2. **Event testing**: Add specific tests for event span handling
3. Add README with configuration examples
4. Integration testing with different span types

## Key Technical Decisions

1. **Root Span Handling**: Root spans become top-level Braintrust spans (no trace wrapper)
2. **Event Handling**: Events become zero-duration spans with matching start/end times
3. **Parent Tracking**: Use `startSpanWithParents` for multi-parent scenarios
4. **Attribute Mapping**: Preserve Mastra metadata while mapping specific fields to Braintrust format
5. **Error Handling**: Use span.log({ error: ... }) pattern for error reporting
6. **Realtime Support**: Optional immediate flushing for development/debugging

## Event Implementation Details

### Event Span Processing

```typescript
private async handleEventSpan(span: AnyAISpan): Promise<void> {
  // Create span with matching start/end times
  const braintrustSpan = this.client.startSpan({
    name: span.name,
    type: this.mapSpanType(span.type),
    startTime: span.startTime.getTime(),
    event: {
      input: undefined, // Events don't have input
      output: span.output,
      // ... other event fields
    }
  });

  // Immediately end with same timestamp
  braintrustSpan.log({
    endTime: span.startTime.getTime(),
    output: span.output
  });
}
```

## Dependencies

- `braintrust`: Latest SDK version
- Same dev dependencies as Langfuse package
- Peer dependency on `@mastra/core` >=0.15.3-0 <0.16.0-0

## Environment Variable Support

Support existing Braintrust environment variables:

- `BRAINTRUST_API_KEY`
- `BRAINTRUST_ENDPOINT`
- Other tuning parameters as documented

## Summary

This plan provides a comprehensive approach to implementing Braintrust observability while:

- Maintaining consistency with the existing Langfuse implementation
- Leveraging Braintrust's unique capabilities and span types
- Handling events gracefully within Braintrust's span-only model
- Supporting all Mastra span types with appropriate mappings
