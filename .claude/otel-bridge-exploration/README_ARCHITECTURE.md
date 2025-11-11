# Mastra Observability Architecture Documentation

## Overview

This directory contains comprehensive documentation of the Mastra observability system, designed to support OpenTelemetry bridge implementation and general understanding of the tracing architecture.

## Documents Included

### 1. SUMMARY.md (Executive Summary - Start Here!)

**Best for**: Quick understanding, implementation checklist, getting started

- 1-minute overview of how the system works
- Critical system characteristics (TraceId assignment, context propagation, span lifecycle)
- Key implementation files with line numbers
- Integration points for OpenTelemetry bridge
- Summary table of all major components
- Files to read, modify, and extend

**When to read**: First, before diving into details

### 2. ARCHITECTURE.md (Deep Dive - Comprehensive Reference)

**Best for**: Understanding system design, implementation details, data structures

- 10 major sections covering every aspect
- ObservabilityInstance implementation with code examples
- getOrCreateSpan() function (critical bridge injection point)
- Span lifecycle and TraceId inheritance mechanism
- Exporter system architecture and event types
- Current context propagation mechanisms
- Span creation flow example
- ExportedSpan structure
- No-Op span system
- Sampling system

**When to read**: After SUMMARY, for deep understanding

### 3. CODE_FLOW.md (Implementation Guide - Practical Reference)

**Best for**: Implementation, code examples, execution flows

- Quick reference to all key code locations
- Detailed flow diagrams (visual representation)
- Span creation flow with ASCII diagrams
- Event emission flow
- TraceId and ParentSpanId inheritance examples
- TraceState and metadata extraction flow
- ExportedSpan structure breakdown
- Sampling flow diagram
- Span lifecycle wrapping explanation
- OTEL bridge integration points with code
- Event timeline example
- Key implementation takeaways

**When to read**: For implementation, when you need to see how things actually flow

### 4. QUICK_REFERENCE.md (Lookup Guide - Tables and Checklists)

**Best for**: Quick lookups, tables, checklists, debugging

- Essential file locations table
- Key methods and line numbers table
- Type hierarchy
- Critical execution paths (3 main paths)
- Span ID formats
- Metadata extraction process
- Event flow to exporters
- Three exporter strategies comparison
- Sampling decisions table
- Export filtering rules
- Configuration defaults
- TraceState computation
- Parent chain resolution algorithm
- NoOpSpan usage pattern
- Bridge implementation checklist
- Common integration points
- Debug tips
- Performance considerations
- Error handling patterns
- Testing entry points

**When to read**: For quick lookups while implementing, debugging, or testing

## Reading Path Recommendations

### Path 1: Quick Learner (30 minutes)

1. Read SUMMARY.md sections 1-5
2. Skim CODE_FLOW.md diagrams
3. Reference QUICK_REFERENCE.md as needed

### Path 2: Implementer (2-3 hours)

1. Read SUMMARY.md completely
2. Read ARCHITECTURE.md sections 1-4 (types and instances)
3. Read CODE_FLOW.md sections 2-3 (span creation and events)
4. Reference QUICK_REFERENCE.md continuously

### Path 3: Deep Dive (4+ hours)

1. Read all documents in order
2. Study code examples in ARCHITECTURE.md
3. Trace through flows in CODE_FLOW.md
4. Review QUICK_REFERENCE.md for reference

### Path 4: Bridge Implementation (Focus)

1. Start with SUMMARY.md "Integration Points for OpenTelemetry Bridge"
2. Read CODE_FLOW.md section 9 "Critical Points for OTEL Bridge Integration"
3. Study ARCHITECTURE.md section 2 "getOrCreateSpan() Function"
4. Use QUICK_REFERENCE.md "Bridge Implementation Checklist"
5. Reference ARCHITECTURE.md section 4 "Exporter System"

## Key Concepts Explained

### TraceId and ParentSpanId

- **Automatic Inheritance**: Child spans inherit parent's traceId through object reference
- **External Context**: Root spans can accept external traceId/parentSpanId via tracingOptions
- **Validation**: TraceId must be 1-32 hex chars, ParentSpanId 1-16 hex chars
- **Generation**: When not provided, generated using crypto.getRandomValues()

### RequestContext

- Type-safe, scoped container for request-level data
- Supports dot notation for nested values
- Metadata extracted at root span creation based on configured keys
- Inherited by all child spans via TraceState

### Span Lifecycle

- **Create**: generateSpanId() + traceId assignment
- **Wire**: Method wrapping to inject event emission
- **Emit Started**: SPAN_STARTED event sent to exporters
- **Update**: SPAN_UPDATED events for modifications
- **End**: SPAN_ENDED event, span closed
- **Export**: Filtered and sent to all exporters

### Sampling

- **Decision Point**: startSpan() entry point (line 99 of base.ts)
- **Strategies**: ALWAYS, NEVER, RATIO, CUSTOM
- **Result**: NoOpSpan if not sampled (no-op all methods, not exported)
- **Benefit**: Prevents memory allocation and event emission for excluded spans

### Event System

- **Three Event Types**: SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED
- **Routing**: Events sent to all exporters concurrently via Promise.allSettled()
- **Filtering**: Invalid/internal spans filtered before export
- **Decoupling**: Exporters independent of span implementation

## Critical File Locations

| File                                               | Purpose            | Key Methods/Lines                          |
| -------------------------------------------------- | ------------------ | ------------------------------------------ |
| `packages/core/src/observability/types/tracing.ts` | Type system        | SpanType, Span, ExportedSpan, TracingEvent |
| `packages/core/src/observability/utils.ts`         | getOrCreateSpan    | Lines 12-47 (BRIDGE INJECTION POINT)       |
| `observability/mastra/src/instances/base.ts`       | startSpan          | Lines 96-134 (CORE LOGIC)                  |
| `observability/mastra/src/spans/default.ts`        | TraceId assignment | Lines 16-49 (INHERITANCE LOGIC)            |
| `observability/mastra/src/exporters/base.ts`       | Exporter base      | exportTracingEvent, init                   |
| `observability/mastra/src/exporters/default.ts`    | Full exporter      | flush, strategies, batching                |

## For OpenTelemetry Bridge Implementation

Start with these sections in order:

1. **SUMMARY.md** - "Critical Integration Points for OpenTelemetry Bridge"
2. **CODE_FLOW.md** - "Section 9: Critical Points for OTEL Bridge Integration"
3. **QUICK_REFERENCE.md** - "Bridge Implementation Checklist"
4. **ARCHITECTURE.md** - Sections 2 and 4 (getOrCreateSpan and Exporter System)

Key implementation decisions:

1. **Extend BaseExporter** - Pattern already established
2. **Handle 3 Event Types** - SPAN_STARTED, SPAN_UPDATED, SPAN_ENDED
3. **Extract W3C Context** - Optionally add to getOrCreateSpan()
4. **Convert Mastra Span** - Map to OpenTelemetry span format
5. **Register as Exporter** - Add to observability.exporters array

## Document Statistics

- **Total Lines**: ~1,867
- **ARCHITECTURE.md**: 551 lines (30%) - Deep technical details
- **CODE_FLOW.md**: 506 lines (27%) - Execution flows and diagrams
- **QUICK_REFERENCE.md**: 380 lines (20%) - Tables and checklists
- **SUMMARY.md**: 430 lines (23%) - Overview and executive summary

## System Statistics

- **Type Definitions**: 438 lines (types/tracing.ts)
- **Implementation**: ~1,074 lines
  - Instances: 452 lines (BaseObservabilityInstance)
  - Spans: 422 lines (BaseSpan + DefaultSpan + NoOpSpan)
- **Exporters**: ~823 lines
  - Base: 162 lines
  - Default: 661 lines
- **Registry**: 118 lines
- **Total Core Code**: ~2,453 lines

## Common Questions Answered

**Q: How does TraceId get to child spans?**
A: Through the `parent` object reference. DefaultSpan constructor checks `parent.traceId` first (ARCHITECTURE.md lines on DefaultSpan).

**Q: What happens if sampling is disabled?**
A: A NoOpSpan is created with all methods as no-ops. It's immediately filtered from export (QUICK_REFERENCE.md "NoOpSpan Usage Pattern").

**Q: How do exporters get events?**
A: Event emission is automatically wired when a span is created (wireSpanLifecycle). All exporters receive events concurrently (CODE_FLOW.md section 3).

**Q: How can I extract W3C trace context?**
A: Currently manual - can be added to getOrCreateSpan() or startSpan() to parse traceparent from RequestContext (CODE_FLOW.md section 9).

**Q: What's the difference between the three exporter strategies?**
A: realtime (immediate), batch-with-updates (default, batched with CRUD ops), insert-only (only final state on SPAN_ENDED). See QUICK_REFERENCE.md table.

**Q: How does metadata extraction work?**
A: TraceState computed at root span with configured keys, metadata extracted from RequestContext using dot notation support. See CODE_FLOW.md section 5.

## Version Information

- **Documentation Date**: November 11, 2025
- **Based on Code**: observability/mastra src directory
- **For Implementation**: OpenTelemetry bridge
- **Completeness**: Very thorough (all 10 sections covered)

## Next Steps

1. **Start Reading**: Begin with SUMMARY.md
2. **Understand Flow**: Study CODE_FLOW.md diagrams
3. **Reference Often**: Keep QUICK_REFERENCE.md handy
4. **Deep Dive**: Read ARCHITECTURE.md for details
5. **Implement**: Use checklists and code examples to build bridge
6. **Debug**: Use QUICK_REFERENCE.md debug tips

## Questions or Clarifications?

If you need clarification on any section:

- **Quick lookup**: Check QUICK_REFERENCE.md
- **Code examples**: See CODE_FLOW.md
- **Architecture details**: Read ARCHITECTURE.md
- **Overview**: Reference SUMMARY.md

All documents cross-reference each other and include file paths and line numbers for easy navigation.
