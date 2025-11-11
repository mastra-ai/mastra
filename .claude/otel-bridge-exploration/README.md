# OpenTelemetry Bridge Exploration

This directory contains comprehensive research and planning documentation for implementing an OpenTelemetry bridge for Mastra observability.

## Quick Navigation

### For Immediate Understanding

1. **Start here**: [SCENARIOS.md](./SCENARIOS.md) - Understand the two integration scenarios with concrete examples
2. **Then read**: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) - See the proposed solution and implementation checklist

### For Deep Dive

3. **Research findings**: [RESEARCH_FINDINGS.md](./RESEARCH_FINDINGS.md) - Complete analysis with open questions
4. **Architecture reference**: [ARCHITECTURE.md](./ARCHITECTURE.md) - Deep dive into current Mastra observability system
5. **Code flow**: [CODE_FLOW.md](./CODE_FLOW.md) - Visual flows and implementation details
6. **Quick reference**: [QUICK_REFERENCE.md](./QUICK_REFERENCE.md) - Tables, file locations, and checklists
7. **Summary**: [SUMMARY.md](./SUMMARY.md) - Executive overview

## The Problem

Mastra observability operates independently from OpenTelemetry, causing trace context to break at the Mastra boundary. This results in disconnected traces that make it difficult to understand end-to-end request flow.

### Visual

```
Before (Current):
Trace 1: [HTTP] → [Service] → [Handler]
Trace 2: [Mastra Agent] → [Model] → [Tool]  ← DISCONNECTED!

After (With Bridge):
Trace 1: [HTTP] → [Service] → [Handler]
                                    └─→ [Mastra Agent] → [Model] → [Tool]  ✓
```

## The Solution

Create an **ObservabilityBridge** that:

1. **Extracts** OTEL trace context (traceId, parentSpanId) from active context or HTTP headers
2. **Injects** that context into Mastra span creation
3. **Exports** Mastra spans back to OTEL collectors as part of the distributed trace

## Two Key Scenarios

### Scenario 1: HTTP Headers (Microservices)

- **Example**: https://github.com/treasur-inc/mastra-hono-tracing-example
- **Context**: Service-to-service communication with W3C `traceparent` header
- **Solution**: Extract headers into RequestContext, bridge reads them

### Scenario 2: Active OTEL Context (Monolithic App)

- **Example**: `examples/stripped-agent-hub-export` (Internal production)
- **Context**: Mastra running inside OTEL-instrumented app
- **Solution**: Bridge reads active OTEL span via `trace.getSpan(context.active())`

## Key Insights

1. **Infrastructure exists**: Mastra already accepts `traceId` and `parentSpanId` via `tracingOptions`. We just need to populate them from OTEL sources.

2. **Minimal core changes**: Only 3 files in core need updates:
   - `packages/core/src/observability/types/tracing.ts` (interface)
   - `packages/core/src/observability/utils.ts` (getOrCreateSpan)
   - `observability/mastra/src/instances/base.ts` (bridge support)

3. **Reuse existing code**: The `observability/otel-exporter` package already has span conversion logic we can reuse.

4. **Both scenarios work with one config**: Use `extractFrom: 'both'` to support both scenarios simultaneously.

## Implementation Phases

### Phase 1: Core Changes (1-2 days)

- Update interfaces and types
- Modify `getOrCreateSpan()` to call bridge
- Update `BaseObservabilityInstance` for bridge support

### Phase 2: OtelBridge Implementation (3-5 days)

- Implement `getCurrentContext()` with dual strategy
- Implement `exportTracingEvent()` with flexible export
- Add configuration options
- Write unit tests

### Phase 3: Integration Testing (2-3 days)

- Test with Hono example (Scenario 1)
- Test with Internal example (Scenario 2)
- Test various OTEL backends (Jaeger, Zipkin, Arize)

### Phase 4: Documentation (1-2 days)

- API docs, usage guides, examples

**Total Estimate**: 1-2 weeks

## Quick Start Example

### Configuration

```typescript
import { Mastra } from '@mastra/core';
import { OtelBridge } from '@mastra/otel-bridge';

const mastra = new Mastra({
  agents: { myAgent },
  observability: {
    configs: {
      default: {
        serviceName: 'my-service',
        bridge: new OtelBridge({
          extractFrom: 'both', // Support both scenarios
          export: {
            useActiveProvider: true, // Use existing OTEL SDK if available
            provider: {
              // Fallback to standalone
              endpoint: 'http://localhost:4318/v1/traces',
              protocol: 'http/protobuf',
            },
          },
        }),
      },
    },
  },
});
```

### Usage (Scenario 2 - Simplest)

```typescript
// No changes needed if OTEL is already initialized!
app.post('/api/chat', async (req, reply) => {
  const result = await agent.generate({
    messages: [{ role: 'user', content: 'Hello' }],
  });
  return result;
});
```

### Usage (Scenario 1 - Headers)

```typescript
import { RuntimeContext } from '@mastra/core/runtime-context';

app.post('/api/chat', async c => {
  const result = await RuntimeContext.with(
    new Map([
      [
        'otel.headers',
        {
          traceparent: c.req.header('traceparent'),
          tracestate: c.req.header('tracestate'),
        },
      ],
    ]),
    async () => {
      return await agent.generate({
        messages: [{ role: 'user', content: 'Hello' }],
      });
    },
  );
  return c.json(result);
});
```

## Architecture Decision Records

### ADR-1: Bridge is separate from Exporter

**Decision**: Create `ObservabilityBridge` as a new interface, not extending `ObservabilityExporter`.

**Rationale**:

- Bridge provides context (input) AND exports spans (output)
- Exporters only handle output
- Clear separation of concerns

### ADR-2: Context extraction via RequestContext

**Decision**: Use RequestContext with `'otel.headers'` convention for Scenario 1.

**Rationale**:

- Consistent with Mastra's existing patterns
- Allows bridge to remain framework-agnostic
- Optional middleware can simplify this for users

### ADR-3: Support both scenarios with single config

**Decision**: `extractFrom: 'both'` as default, tries active context first, then headers.

**Rationale**:

- Maximum compatibility
- Users don't need to know their scenario
- Fallback behavior is intuitive

### ADR-4: Respect OTEL sampling

**Decision**: If bridge context has `isSampled: false`, don't create span.

**Rationale**:

- OTEL made a sampling decision upstream
- Respecting it prevents partial traces
- Mastra can still apply additional filtering on top

### ADR-5: Reuse OtelExporter span conversion

**Decision**: Share `SpanConverter` class between OtelExporter and OtelBridge.

**Rationale**:

- DRY principle
- Consistent span format
- Easier maintenance

## Open Questions

See [RESEARCH_FINDINGS.md](./RESEARCH_FINDINGS.md#open-questions-for-discussion) for detailed discussion of:

1. RequestContext key convention
2. Sampling behavior details
3. Export strategy auto-detection
4. Error handling approaches
5. Bridge lifecycle (sync vs async init)
6. Multiple bridges support
7. Header extraction helpers

## Next Steps

1. **Review these docs** with the team
2. **Discuss open questions** and make decisions
3. **Create GitHub issues** for each implementation phase
4. **Start Phase 1** implementation
5. **Iterate** based on testing feedback

## Files in This Directory

| File                         | Purpose                                          | Read If...                                     |
| ---------------------------- | ------------------------------------------------ | ---------------------------------------------- |
| README.md                    | This file - overview and navigation              | You're starting                                |
| **UPDATED_PLAN.md**          | **Final implementation plan with all decisions** | **You're ready to implement**                  |
| ALL_SCENARIOS.md             | Complete scenario analysis (A-H)                 | You need to understand all use cases           |
| FRAMEWORK_AGNOSTIC_DESIGN.md | Framework support strategy using OTEL packages   | You want to understand framework compatibility |
| SCENARIOS.md                 | Detailed scenario analysis for A & B             | You need examples for the two main scenarios   |
| IMPLEMENTATION_PLAN.md       | Original step-by-step guide                      | You want the initial plan                      |
| RESEARCH_FINDINGS.md         | Complete research with user responses            | You need deep context and Q&A                  |
| ARCHITECTURE.md              | Mastra observability system deep dive            | You need architecture details                  |
| CODE_FLOW.md                 | Visual flows and code snippets                   | You need implementation patterns               |
| QUICK_REFERENCE.md           | Tables, locations, checklists                    | You need quick lookups                         |
| SUMMARY.md                   | Executive summary                                | You need high-level overview                   |

## Credits

Research conducted by Claude Code analyzing:

- User examples (Hono tracing, Internal agent-hub)
- Mastra core observability system
- Existing OtelExporter implementation
- OpenTelemetry specifications and APIs

Date: November 11, 2025
