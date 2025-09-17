# Mastra Observability Documentation Plan

## Executive Summary

This document outlines the comprehensive plan to revise Mastra's observability documentation, with the primary goal of removing AI Tracing's experimental status by v0.18.0. The documentation currently supports two parallel tracing systems (OTLP and AI Tracing), with OTLP scheduled for deprecation.

## Current State Analysis

### Documentation Structure

```
docs/src/content/en/
├── docs/observability/          # Conceptual documentation
│   ├── logging.mdx             # 113 lines
│   ├── tracing.mdx             # 190 lines (OTLP)
│   ├── ai-tracing.mdx          # 597 lines (experimental)
│   └── nextjs-tracing.mdx      # 109 lines (hidden)
├── reference/observability/     # Mixed API docs and guides
│   ├── logger.mdx              # PinoLogger API
│   ├── otel-config.mdx         # OTLP configuration
│   └── providers/              # 15 provider setup guides
└── examples/                    # No observability examples ⚠️
```

### Two Parallel Tracing Systems

#### OTLP Tracing (Being Deprecated)

- Configuration via `telemetry` property in Mastra config
- Exports to any OpenTelemetry collector
- 15 provider integration guides
- Stable but being phased out
- No deprecation timeline set

#### AI Tracing (Future Focus)

- Configuration via `observability` property in Mastra config
- Specialized for AI operations (agents, LLMs, tools, workflows)
- Provider-native formats (Langfuse, Braintrust)
- Currently marked experimental (v0.14.0+)
- **Built-in Exporters:**
  - DefaultExporter: Persists to storage (libsql, memory - undocumented)
  - CloudExporter: Sends to Mastra Cloud (requires token)
- **Third-party Exporters:**
  - Langfuse: Supports realtime and batch modes
  - Braintrust: For AI evaluation
  - OpenTelemetry: Coming soon
  - PostHog: High user demand

### Key Problems

#### Visibility Issues

- Observability not mentioned in main docs introduction
- Listed 23rd in navigation structure
- No working examples in `/examples` directory

#### Documentation Gaps

- No migration guide from OTLP to AI Tracing
- Missing production best practices
- DefaultExporter storage providers undocumented
- Configuration and configSelector not documented
- No troubleshooting guide

#### User Pain Points (From GitHub Issues)

- **#7727**: Can't filter postgres insert traces (cluttering observability)
- **#7479**: Tables growing huge, need cleanup strategies
- **#7175**: Can't merge traces when using client-side tools
- **#6702**: Langfuse not working in Vercel deployments
- **#7813**: MASTRA_TELEMETRY_DISABLED flag not working
- **#7508**: PostHog exporter requested for LLM analytics
- **#6005**: Braintrust integration not working
- **#5802**: Concerns about sensitive data leakage

## Implementation Strategy

### Phase 1: Critical Tasks (Blocking Experimental Removal)

#### 1.1 Update Main Introduction

Location: `docs/src/content/en/docs/index.mdx`

Add after Evals section (line 22):

```markdown
- **[AI Observability](/docs/observability/overview.mdx)**: Mastra provides specialized AI tracing to monitor LLM operations, agent decisions, and tool executions. Track token usage, latency, and conversation flows with built-in exporters for Langfuse, Braintrust, and Mastra Cloud. Structured logging provides additional debugging capabilities for comprehensive monitoring.
```

#### 1.2 Create Overview Page

New file: `docs/src/content/en/docs/observability/overview.mdx`

Content structure:

- High-level introduction to Mastra observability
- Key features (AI Tracing, Logging)
- Quick start with basic AI Tracing setup
- Feature comparison table (AI Tracing vs OTLP)
- Decision tree: Which approach to use
- Links to detailed documentation

#### 1.3 Reorder and Update Navigation

File: `docs/src/content/en/docs/observability/_meta.tsx`

```tsx
const meta = {
  overview: 'Overview',
  'ai-tracing': 'AI Tracing', // Remove experimental tag when ready
  tracing: 'Tracing (OTLP)',
  logging: 'Logging',
  'nextjs-tracing': { title: 'Next.js Tracing', display: 'hidden' },
};
```

#### 1.4 Simplify AI Tracing Documentation

File: `docs/src/content/en/docs/observability/ai-tracing.mdx`

**Move to Reference:**

- Detailed exporter configurations (lines 175-355)
- Custom processor implementations (lines 541-595)
- Detailed span type attributes (lines 413-436)

**Keep in Docs:**

- Introduction and concepts (lines 1-51)
- Basic configuration (lines 52-168)
- Common usage patterns (lines 437-498)
- Links to reference for advanced topics

### Phase 2: Reference Section Restructure

#### New Reference Structure

```
reference/observability/
├── ai-tracing/                   # AI-specific Tracing
│   ├── _meta.ts
│   ├── ai-tracing.mdx           # MastraAITracing class
│   ├── configuration.mdx        # Config options and configSelector
│   ├── exporters/
│   │   ├── default-exporter.mdx # DefaultExporter class + storage providers
│   │   ├── cloud-exporter.mdx   # CloudExporter class
│   │   └── console-exporter.mdx # ConsoleExporter class
│   ├── processors/
│   │   └── sensitive-data-filter.mdx # SensitiveDataFilter
│   ├── spans/
│   │   ├── agent-span.mdx       # Agent span types and attributes
│   │   ├── llm-span.mdx         # LLM span types and attributes
│   │   └── workflow-span.mdx    # Workflow span types and attributes
│   └── sampling/
│       └── sampling-strategies.mdx # Sampling configuration
│
├── tracing/                      # Traditional OTLP (mark as deprecated)
│   ├── _meta.ts
│   ├── otel-config.mdx          # OtelConfig class
│   ├── telemetry-options.mdx    # Configuration options
│   └── providers/               # Keep here but mark deprecated
│       ├── _meta.ts            # Update title: "OTLP Providers (Deprecated)"
│       └── [15 provider files]  # Add deprecation notice to each
│
└── logging/
    ├── _meta.ts
    ├── pino-logger.mdx          # PinoLogger class
    ├── console-logger.mdx       # ConsoleLogger class
    └── transports/
        ├── file-transport.mdx   # FileTransport class
        └── custom-transport.mdx # Custom transport guide
```

#### Key Documentation Requirements

**DefaultExporter Documentation Must Include:**

- Supported storage providers (libsql, memory)
- Strategy selection (auto, realtime, batch-with-updates, insert-only)
- Configuration options (batch size, retry logic)
- Examples with different storage backends

**Configuration Documentation Must Include:**

- Complete config schema with all properties
- configSelector function examples
- Multi-instance configuration patterns
- Runtime context usage

### Phase 3: Examples Section Creation

#### New Examples Structure

```
examples/observability/
├── _meta.ts
├── basic-ai-tracing.mdx              # Getting started
├── langfuse-integration.mdx          # Langfuse setup
├── braintrust-integration.mdx        # Braintrust setup
├── migration-from-otlp.mdx           # OTLP → AI Tracing
├── sensitive-data-filtering.mdx      # Privacy/security
├── trace-filtering.mdx               # Filter unwanted traces
├── custom-metadata.mdx               # Adding debug context
├── trace-merging.mdx                 # Client-side tools
├── cleanup-strategies.mdx            # Managing storage
├── best-practices.mdx                # Production patterns
├── troubleshooting.mdx               # Common issues
└── custom-exporter.mdx               # Build your own
```

#### Priority Examples Content

**1. basic-ai-tracing.mdx**

- Simple agent with Default + Cloud exporters
- Show traces in playground and cloud
- Explain automatic instrumentation

**2. langfuse-integration.mdx**
Must include:

- Default + Cloud + Langfuse exporters together
- Environment flag configuration:

```typescript
new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASEURL,
  options: {
    environment: config.ENVIRONMENT, // Shows in Langfuse UI
  },
});
```

- Vercel deployment troubleshooting
- Realtime vs batch mode selection

**3. trace-filtering.mdx**
Address #7727:

- Filter postgres insert traces
- Exclude specific span types
- Custom filtering logic

**4. cleanup-strategies.mdx**
Address #7479:

- Database maintenance queries
- Retention policies
- Archival strategies

**5. trace-merging.mdx**
Address #7175:

- Handle client-side tool calls
- Maintain trace continuity
- Session-based tracing

### Phase 4: URL Redirects

Add to `docs/config/redirects.mjs`:

```javascript
// Reference restructure redirects
{
  source: "/:locale/reference/observability/logger",
  destination: "/:locale/reference/observability/logging/pino-logger",
  permanent: true,
},
{
  source: "/:locale/reference/observability/otel-config",
  destination: "/:locale/reference/observability/tracing/otel-config",
  permanent: true,
},
// Add redirect for each moved page
```

## Technical Implementation Details

### AI Tracing Architecture

- Uses decorators for automatic instrumentation
- Storage backends determine exporter strategies
- Sensitive data filtering enabled by default
- Supports multiple concurrent exporters
- Batch processing with configurable size/timing

### Supported Span Types

**Agent Operations:**

- AGENT_RUN
- LLM_GENERATION
- TOOL_CALL
- MCP_TOOL_CALL

**Workflow Operations:**

- WORKFLOW_RUN
- WORKFLOW_STEP
- WORKFLOW_CONDITIONAL
- WORKFLOW_PARALLEL
- WORKFLOW_LOOP

### Storage Provider Details

**DefaultExporter Storage Support:**

- **libsql**: Full support with batch updates
- **memory**: Development/testing only
- **postgres**: Coming soon
- Strategy auto-selected based on capabilities

## Quick Wins (Immediate Actions)

1. Update `_meta.tsx` to reorder navigation (AI Tracing first)
2. Add Langfuse environment tip to current docs
3. Document Default + Cloud exporters being automatically included
4. Add note about OTLP future deprecation
5. Create basic AI tracing example

## Known Documentation Bugs to Fix

1. Missing information about Default and Cloud exporters
2. No documentation on disabling tracing (#7813)
3. Vercel deployment issues not documented (#6702)
4. No guidance on filtering unwanted traces (#7727)
5. Missing trace merging documentation (#7175)
6. Storage provider support not documented

## Success Metrics

### Primary Goals

- AI Tracing experimental tag removed by v0.18.0
- Documentation completeness for all AI Tracing features

### User Experience Metrics

- 50% reduction in observability-related support issues
- Successful Vercel deployments with Langfuse
- Clear migration path from OTLP

### Adoption Metrics

- Increased usage of Default + Cloud + External pattern
- Proper trace filtering in production
- Successful trace merging for client-side tools

## Team Decisions & Constraints

### Priorities

- **Focus**: AI Tracing and Logging only
- **Providers**: Mastra (Default/Cloud), Langfuse, Braintrust
- **Coming Soon**: OpenTelemetry exporter, PostHog exporter

### What NOT to Do

- Don't create OTLP examples
- Don't mention LangSmith exporter (in limbo)
- Don't spend time on non-priority providers
- Don't remove OTLP docs yet (no timeline)
- Minimal changes to OTLP docs section

## Implementation Checklist

### Documentation Tasks

- [ ] Main introduction updated with AI observability
- [ ] Overview.mdx created with comparison table
- [ ] AI Tracing docs simplified (details moved to reference)
- [ ] Navigation reordered (AI Tracing before OTLP)
- [ ] Experimental tag removed from AI Tracing

### Reference Section

- [ ] AI Tracing reference structure created
- [ ] Configuration.mdx with configSelector docs
- [ ] DefaultExporter docs include storage providers
- [ ] All exporter classes documented
- [ ] OTLP providers marked as deprecated

### Examples Section

- [ ] Basic AI tracing example
- [ ] Langfuse integration with environment flag
- [ ] Braintrust integration
- [ ] Migration guide from OTLP
- [ ] Trace filtering example
- [ ] Cleanup strategies
- [ ] At least 8 examples total

### Technical Tasks

- [ ] URL redirects added to redirects.mjs
- [ ] All moved pages have redirects
- [ ] Team review completed
- [ ] Testing in staging environment

---

_Document Status: Ready for Implementation_
_Created: January 2025_
_Target Release: v0.18.0_
