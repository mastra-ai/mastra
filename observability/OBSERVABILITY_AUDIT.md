# Mastra Observability Documentation Audit

## Executive Summary

This document provides a comprehensive audit of Mastra's observability documentation as of January 2025. The observability system is in transition, with two parallel tracing systems (traditional OTLP and new AI Tracing) and ongoing improvements tracked in GitHub issue #6773.

## Current Documentation Structure

### Primary Documentation Files

```
docs/src/content/en/docs/observability/
├── _meta.tsx                  # Navigation metadata
├── logging.mdx                # PinoLogger documentation
├── tracing.mdx                # OpenTelemetry (OTLP) tracing
├── nextjs-tracing.mdx         # Next.js specific (hidden)
└── ai-tracing.mdx             # AI-specific tracing (experimental)
```

### Related Documentation

- `docs/mastra-cloud/observability.mdx` - Cloud dashboard features
- `reference/observability/` - API references and provider guides
  - 15 provider integration guides (Langfuse, Braintrust, SigNoz, etc.)
  - PinoLogger API reference
  - OtelConfig reference

## Key Findings

### 1. Two Parallel Tracing Systems

#### Traditional OTLP Tracing (`tracing.mdx`)

- Based on OpenTelemetry Protocol
- Focuses on infrastructure and application monitoring
- Exports to any OTEL collector
- Configuration via `telemetry` property in Mastra config
- More mature, stable API

#### AI Tracing (`ai-tracing.mdx`)

- Specialized for AI operations (agents, LLMs, tools, workflows)
- Provider-native formats (Langfuse, Braintrust)
- Configuration via `observability` property in Mastra config
- Marked as experimental (as of v0.14.0)
- Actively being developed (see GitHub #6773)

### 2. Documentation Strengths

- **Comprehensive AI Tracing Guide**: 598 lines covering configuration, exporters, sampling, processors
- **Clear Code Examples**: Well-formatted TypeScript examples with proper syntax highlighting
- **Multiple Export Options**: Documents various exporters and their configurations
- **Provider Coverage**: 15 different observability provider guides

### 3. Documentation Gaps

#### Visibility Issues

- **Not in Main Introduction**: Observability is completely absent from the main docs index despite being a critical feature
- **No Navigation Prominence**: Listed 23rd in the navigation structure
- **No Examples**: Zero examples in `/examples` directory actually implement observability

#### Content Gaps (To Be Addressed in Examples)

- **Migration Path**: Will be covered in `examples/observability/migration-from-otlp.mdx`
- **Feature Comparison**: Include in overview.mdx
- **Production Guidance**: Will be covered in `examples/observability/best-practices.mdx`
- **Troubleshooting**: Will be covered in `examples/observability/troubleshooting.mdx`

#### Technical Documentation Issues

- **Experimental Status Confusion**: AI Tracing marked experimental but heavily developed
- **Configuration Overlap**: Unclear when to use `telemetry` vs `observability` config
- **Performance Impact**: No documentation on sampling strategy performance implications

### 4. Recent Development Activity

#### Commits (Last 20 observability-related)

- Focus on AI Tracing improvements and bug fixes
- New exporters: DefaultExporter, CloudExporter
- Sensitive data filtering improvements
- Out-of-order span error prevention
- Internal span hiding capabilities

#### Active Issues

- #6773: AI Tracing refresh (umbrella issue with 54 comments)
- #7571: Langsmith exporter request
- #7813: Telemetry disable flag bug
- #6702: Langfuse not working in Vercel
- Multiple provider-specific issues

### 5. Implementation Architecture

#### Built-in Exporters

1. **DefaultExporter**
   - Persists to configured storage backend
   - Automatic batching and retry logic
   - Strategy selection based on storage capabilities

2. **CloudExporter**
   - Sends to Mastra Cloud for visualization
   - Token-based authentication
   - Graceful fallback when not configured

#### Third-party Exporters

- Langfuse (with real-time mode support)
- Braintrust
- OpenTelemetry (coming soon)

#### Span Types Supported

- **Agent Operations**: AGENT_RUN, LLM_GENERATION, TOOL_CALL
- **Workflow Operations**: WORKFLOW_RUN, WORKFLOW_STEP, conditionals, loops
- **Custom Operations**: GENERIC spans for custom tracking

## Recommendations for Documentation Revision

### Priority 1: Improve Visibility

1. Add observability section to main introduction page
2. Create a "Why Observability?" section explaining benefits
3. Move observability higher in navigation structure
4. Add observability setup to Getting Started guide

### Priority 2: Clarify System Differences

1. Create comparison table: OTLP vs AI Tracing
2. Add decision tree: "Which tracing system should I use?"
3. Document migration path from OTLP to AI Tracing
4. Clarify experimental vs production-ready features

### Priority 3: Add Practical Content

1. Create working examples in `/examples` directory
2. Add troubleshooting guide with common issues
3. Document performance best practices
4. Include production deployment patterns

### Priority 4: Improve Technical Accuracy

1. Remove marketing language per CLAUDE.md guidelines
2. Update provider documentation with latest versions
3. Add API stability guarantees
4. Document breaking changes clearly

## Style Guide Violations Found

Per CLAUDE.md writing guidelines, the following should be removed:

- "powerful monitoring and debugging" → "monitoring and debugging"
- "makes it easier" → "enables"
- "full visibility" → "visibility"
- "seamless integration" → "integration"

## Reference Section Analysis

### Current Observability Reference Structure

The observability reference section differs significantly from other reference sections:

```
reference/observability/
├── _meta.ts               # Simple object with 3 entries
├── logger.mdx            # PinoLogger documentation (guide-like)
├── otel-config.mdx       # OtelConfig documentation (guide-like)
└── providers/            # 15 provider setup guides (how-to content)
```

**Issues:**

- Contains how-to guides and setup instructions rather than API reference
- Provider guides are configuration tutorials, not API documentation
- Lacks the method-focused structure of other reference sections
- Mixed content types (API reference, configuration guides, integration tutorials)

### Standard Reference Section Pattern

Other reference sections follow a consistent API-focused pattern:

**Agents Reference Example:**

```
reference/agents/
├── agent.mdx                     # Core class documentation
├── generate.mdx                  # Method: .generate()
├── generateVNext.mdx             # Method: .generateVNext()
├── network.mdx                   # Method: .network()
├── listAgents.mdx               # Method: .listAgents()
└── [other methods...]            # Individual method docs
```

**CLI Reference Example:**

```
reference/cli/
├── create-mastra.mdx             # Command: create-mastra
├── init.mdx                      # Command: mastra init
├── dev.mdx                       # Command: mastra dev
└── [other commands...]           # Individual command docs
```

**Common Pattern:**

1. Core class/module documentation
2. Individual pages for each method/command
3. Consistent PropertiesTable components for parameters
4. Usage examples followed by API details
5. Clear separation of API reference from guides

### Proposed Observability Reference Restructure

```
reference/observability/
├── tracing/                      # Traditional OTLP Tracing (deprecated)
│   ├── _meta.ts
│   ├── otel-config.mdx          # OtelConfig class
│   ├── telemetry-options.mdx    # Configuration options
│   └── providers/               # Keep OTEL providers here (reformatted)
│       ├── _meta.ts            # Mark as "OTLP Providers (Deprecated)"
│       └── [15 provider files]  # Reformat to note deprecation
│
├── ai-tracing/                   # AI-specific Tracing
│   ├── _meta.ts
│   ├── ai-tracing.mdx          # MastraAITracing class
│   ├── configuration.mdx        # Config options and configSelector
│   ├── exporters/
│   │   ├── default-exporter.mdx # DefaultExporter class + storage providers
│   │   ├── cloud-exporter.mdx   # CloudExporter class
│   │   └── console-exporter.mdx # ConsoleExporter class
│   ├── processors/
│   │   └── sensitive-data-filter.mdx # SensitiveDataFilter
│   ├── spans/
│   │   ├── agent-span.mdx       # Agent span types
│   │   ├── llm-span.mdx         # LLM span types
│   │   └── workflow-span.mdx    # Workflow span types
│   └── sampling/
│       └── sampling-strategies.mdx # Sampling configuration
│
├── logging/
│   ├── _meta.ts
│   ├── pino-logger.mdx          # PinoLogger class
│   ├── console-logger.mdx       # ConsoleLogger class
│   └── transports/
│       ├── file-transport.mdx   # FileTransport class
│       └── custom-transport.mdx # Custom transport guide
│
└── _meta.ts                     # Top-level navigation
```

**Notes:**

- OTEL provider guides stay in reference but marked as deprecated
- DefaultExporter docs must include supported storage providers (libsql, memory)
- Configuration section includes configSelector documentation

### Required Changes

1. **Keep OTEL provider guides** in reference/tracing/providers but mark as deprecated
2. **Create API-focused pages** for each class/method
3. **Separate OTLP and AI Tracing** into distinct subsections
4. **Add missing API documentation** for:
   - MastraAITracing class
   - Configuration and configSelector
   - All exporter classes (with storage provider details for DefaultExporter)
   - Span processor interfaces
   - Sampling strategies
5. **Standardize format** with PropertiesTable components
6. **Remove guide content** from API reference pages

## Docs Section Restructure Plan

### Current vs Desired Pattern

Other docs sections follow a consistent pattern:

1. **overview.mdx** - High-level introduction and key concepts
2. **Conceptual pages** - Core features and capabilities
3. **How-to guides** - Practical implementation
4. **Links to reference** - API details

### Proposed Docs Section Structure

```
docs/observability/
├── _meta.tsx                    # Updated navigation
├── overview.mdx                 # NEW: High-level intro to observability
├── ai-tracing.mdx              # Simplified: Concepts and getting started
├── tracing.mdx                 # Simplified: OTLP concepts and getting started
├── logging.mdx                 # Simplified: Logging concepts and getting started
└── nextjs-tracing.mdx          # Keep hidden
```

### Navigation Order (\_meta.tsx)

```tsx
{
  overview: "Overview",
  "ai-tracing": <Tag text="experimental">AI Tracing</Tag>,
  tracing: "Tracing",
  logging: "Logging",
  "nextjs-tracing": { title: "Next.js Tracing", display: "hidden" }
}
```

### Content Migration Plan

#### From ai-tracing.mdx to Reference

**Move to reference:**

- Detailed exporter configurations (lines 175-355)
- Custom processor implementation (lines 541-595)
- Detailed span type attributes (lines 413-436)

**Keep in docs:**

- Introduction and concepts (lines 1-51)
- Basic configuration (lines 52-168)
- Overview of exporters (simplified list)
- Common usage patterns (lines 437-498)

#### From tracing.mdx to Reference

**Move to reference:**

- Detailed OtelConfig options
- Custom instrumentation details
- Provider-specific configurations

**Keep in docs:**

- Basic setup and configuration
- Environment variables overview
- Quick start example

#### From logging.mdx to Reference

**Move to reference:**

- Transport implementation details
- Formatter options

**Keep in docs:**

- Basic logger setup
- Common logging patterns
- Integration with workflows/tools

### New overview.mdx Content Structure

```markdown
# Observability Overview

Mastra provides comprehensive observability through specialized AI tracing,
traditional application tracing, and structured logging.

## Key Features

- **AI Tracing**: Track LLM operations, agent decisions, and tool executions
- **Application Tracing**: Monitor infrastructure and performance with OpenTelemetry
- **Logging**: Structured logs for debugging and monitoring

## Quick Start

[Basic setup example with AI Tracing]

## Choosing Your Observability Strategy

[Decision tree for AI vs OTLP tracing]

## Available Exporters

[List with links to reference docs]
```

## Main Introduction Addition

### Proposed Addition to docs/index.mdx

Add after the Evals bullet point (line 22):

```markdown
- **[AI Observability](/docs/observability/overview.mdx)**: Mastra provides specialized AI tracing to monitor LLM operations, agent decisions, and tool executions. Track token usage, latency, and conversation flows with built-in exporters for Langfuse, Braintrust, and Mastra Cloud. Structured logging provides additional debugging capabilities for comprehensive monitoring.
```

This addition:

- Highlights AI-specific capabilities first
- Mentions key exporters for recognition
- Focuses on AI tracing (no OTLP mention as it's being deprecated)
- Links to the new overview page

## Examples Section Proposal

### Current Examples Pattern

Examples sections in Mastra follow a consistent format:

- **Practical use cases** - Real-world scenarios users need
- **Complete code** - Full working examples, not snippets
- **Prerequisites** - Clear setup requirements (API keys, packages)
- **50-150 lines** - Focused but complete implementations
- **Explanatory text** - Context before and after code

### Proposed Observability Examples

```
examples/observability/
├── _meta.ts
├── basic-ai-tracing.mdx              # Getting started with AI tracing
├── langfuse-integration.mdx          # Complete Langfuse setup
├── braintrust-evaluation.mdx         # Using Braintrust for evals
├── migration-from-otlp.mdx           # Migrating from OTLP to AI Tracing
├── custom-span-metadata.mdx          # Adding debugging context
├── sensitive-data-filtering.mdx      # Redacting PII/secrets
├── multi-environment-setup.mdx       # Dev vs prod configuration
├── sampling-strategies.mdx           # Performance optimization
├── trace-filtering.mdx               # Filtering unwanted traces
├── trace-merging.mdx                 # Handling client-side tools
├── cleanup-strategies.mdx            # Managing trace storage
├── best-practices.mdx                # Production best practices
├── troubleshooting.mdx               # Common issues and solutions
└── custom-exporter.mdx               # Building custom exporters
```

**Note**: Migration guide, best practices, and troubleshooting belong in examples (not guides) as they are practical implementations

### Example Content Structure

#### basic-ai-tracing.mdx

```markdown
---
title: 'Example: Basic AI Tracing Setup | Observability | Mastra'
description: Getting started with AI tracing in Mastra applications
---

# Basic AI Tracing Setup

This example shows how to set up AI tracing to monitor your agents and workflows.

## Prerequisites

- Mastra Cloud account or self-hosted storage
- OpenAI API key

## Setup

[Complete working example with agent + tracing]

## Viewing Traces

[How to see results in dashboard]
```

#### langfuse-integration.mdx

```markdown
# Langfuse Integration

Complete setup for using Langfuse to trace AI operations, including
real-time mode for development and batch mode for production.

## Prerequisites

- Langfuse account (cloud or self-hosted)
- API keys from Langfuse dashboard

## Configuration

[Full setup with environment variables and config]

## Real-time vs Batch Mode

[Examples of both modes with use cases]
```

#### sensitive-data-filtering.mdx

```markdown
# Filtering Sensitive Data

Protect user privacy and security by automatically redacting
sensitive information from traces.

## Built-in Filtering

[Using SensitiveDataFilter]

## Custom Redaction Rules

[Creating custom processors]

## Testing Your Filters

[Verification examples]
```

### Why These Examples?

1. **Basic setup** - Most users start here
2. **Provider integrations** - Common next step
3. **Privacy/security** - Critical for production
4. **Performance** - Sampling for scale
5. **Debugging** - Custom metadata for troubleshooting
6. **Cost tracking** - Token usage monitoring
7. **Multi-env** - Dev/staging/prod patterns

## Implementation Priority

### Phase 1: Documentation Structure (Immediate)

1. Create overview.mdx for observability
2. Reorder navigation (AI tracing first)
3. Add observability to main introduction
4. Simplify existing docs pages

### Phase 2: Reference Section (Short-term)

1. Create API reference structure
2. Move detailed configurations to reference
3. Add missing API documentation
4. Move provider guides to appropriate location

### Phase 3: Examples Section (Short-term)

1. Create examples/observability directory
2. Add 5-6 core examples (basic, Langfuse, filtering, metadata)
3. Link from docs and reference sections

### Phase 4: Content Enhancement (Medium-term)

1. Add remaining examples
2. Create troubleshooting guide
3. Document migration paths
4. Add performance best practices

## Important: URL Redirects

When restructuring documentation, **redirects must be added** to `docs/config/redirects.mjs` to preserve existing links and SEO. This file contains 816+ redirects maintaining backward compatibility.

### Redirect Format

```javascript
{
  source: "/:locale/docs/old-path",
  destination: "/:locale/docs/new-path",
  permanent: true,
}
```

### Required Redirects for This Restructure

If we move provider guides from reference to docs:

```javascript
// Example redirects needed
{
  source: "/:locale/reference/observability/providers/langfuse",
  destination: "/:locale/docs/observability/providers/langfuse",
  permanent: true,
},
{
  source: "/:locale/reference/observability/providers/braintrust",
  destination: "/:locale/docs/observability/providers/braintrust",
  permanent: true,
},
// ... for all 15 providers
```

If we restructure reference section:

```javascript
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
```

### Redirect Strategy

1. **Preserve all existing URLs** - Add redirects for any moved content
2. **Test thoroughly** - Verify old links redirect correctly
3. **Document changes** - Keep a list of URL changes for release notes
4. **SEO preservation** - Use permanent redirects (301) for moved content

## Next Steps

1. **Immediate**: Update main introduction to mention observability
2. **Immediate**: Create overview.mdx for observability section
3. **Short-term**: Restructure reference section to match API pattern
4. **Short-term**: Simplify docs section (move details to reference)
5. **Short-term**: **Add redirects** for all moved pages to `redirects.mjs`
6. **Medium-term**: Add practical examples and troubleshooting guides
7. **Long-term**: Consolidate around single tracing system once AI Tracing stabilizes

## Additional Context from Research

### Current Package Structure

The observability packages are located at repository root:

- `observability/langfuse/` - Langfuse exporter package
- `observability/braintrust/` - Braintrust exporter package
- `observability/opentelemetry/` - OTLP exporter (coming soon)

### Related Documentation Files

- `docs/src/content/en/docs/mastra-cloud/observability.mdx` - Cloud-specific observability
- `docs/src/content/en/docs/getting-started/` - Should mention observability setup
- `CLAUDE.md` - Contains writing guidelines (avoid marketing language)

### Technical Implementation Notes

- AI Tracing uses decorators for automatic instrumentation
- Storage backends determine exporter strategies (realtime vs batch)
- Sensitive data filtering is enabled by default
- CloudExporter requires `MASTRA_CLOUD_ACCESS_TOKEN` env var
- DefaultExporter handles storage persistence automatically
  - **Supported storage providers**: libsql, memory (needs documentation)
  - Storage strategy auto-selected based on capabilities
- **Langfuse Tip**: Set environment in Langfuse UI by passing it in options:
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

### Documentation Dependencies

- Uses `PropertiesTable` component for API documentation
- Uses `Tag` component for experimental features
- Uses `nextra` for documentation framework
- Supports `showLineNumbers` and `copy` attributes on code blocks

### Common User Issues (from GitHub)

- **Export/Integration Issues**
  - #7571: LangSmith exporter requested
  - #7508: PostHog exporter requested (for LLM analytics)
  - #6702: Langfuse not working in Vercel deployments
  - #6005: Braintrust not working at all
  - #6182: Datadog support requested

- **Trace Management**
  - #7175: Need to merge multiple traces (client-side tools issue)
  - #7521: Workflow traces not nesting properly (fixed)
  - #6414: Missing OTEL spans in playground
  - #6415: No traces in cloud
  - #7590: StreamVNext tracing structure differs from legacy

- **Performance/Storage**
  - #7727: Need to disable/filter postgres insert traces
  - #7479: Cleanup strategy for old traces (tables growing huge)
  - #7559: Memory (RAM) issues

- **Configuration/Control**
  - #7813: Telemetry sending despite MASTRA_TELEMETRY_DISABLED flag
  - #7676: Adding custom metadata to Langfuse traces (fixed)
  - #7275: TracingContext not available in tool calls (fixed)
  - #7463: Console logging issues

- **Security/Privacy**
  - #5802: Concerns about sensitive data leakage

### Migration Considerations

- Users currently on OTLP tracing need clear migration path
- Existing Langfuse users may have both OTLP and AI tracing configs
- Provider API keys and endpoints must be preserved during migration
- Backward compatibility for `telemetry` config property

## Team Decisions & Priorities

### Answered Questions

1. **AI Tracing timeline**: Moving out of experimental ASAP - documentation is a blocker
2. **OTLP deprecation**: Yes, will be deprecated (no timeline yet)
   - Minimal changes to OTLP docs section
   - Can update OTLP reference section more significantly
   - NO examples for OTLP tracing
3. **Documentation focus**: Prioritize AI Tracing and Logging
4. **Priority providers**:
   - Mastra (playground and cloud)
   - Langfuse
   - Braintrust
   - OpenTelemetry exporter (coming soon)
   - PostHog exporter (requested by users)
5. **Cloud + External exporters**: Examples should include Default + Cloud + External exporters together
6. **Provider guides**: Move to examples/reference sections, link from docs
7. **LangSmith**: Don't mention yet (in limbo)

### Open Questions

8. Should we document workarounds for known issues (Vercel, playground)?

## Updated Implementation Strategy

Based on team priorities:

### Phase 1: Remove Experimental Status Blockers

1. Create comprehensive AI Tracing documentation
2. Move provider guides to examples/reference
3. Create overview.mdx with clear AI Tracing focus
4. Add AI Tracing to main introduction

### Phase 2: Minimal OTLP Updates

1. Keep existing OTLP docs mostly unchanged
2. Add deprecation notice (when timeline decided)
3. NO new OTLP examples
4. Update reference if needed

### Phase 3: Priority Examples

Focus on priority providers and addressing all content gaps:

1. `basic-ai-tracing.mdx` - Default + Cloud exporters
2. `langfuse-integration.mdx` - Default + Cloud + Langfuse
   - Include environment flag trick for Langfuse UI
   - Address Vercel deployment issues
3. `braintrust-integration.mdx` - Default + Cloud + Braintrust
4. `migration-from-otlp.mdx` - Clear migration path (#56)
5. `sensitive-data-filtering.mdx` - Privacy/security (#5802)
6. `trace-filtering.mdx` - Filtering postgres/unwanted traces (#7727)
7. `custom-metadata.mdx` - Adding context to traces (#7676)
8. `trace-merging.mdx` - Handling client-side tools (#7175)
9. `cleanup-strategies.mdx` - Managing trace storage (#7479)
10. `best-practices.mdx` - Production deployment patterns (#59)
11. `troubleshooting.mdx` - Common issues and solutions (#60)

### What NOT to Do

- Don't create OTLP examples
- Don't mention LangSmith exporter
- Don't spend time on non-priority providers
- Don't remove OTLP docs yet (no deprecation timeline)

## Critical Documentation Tasks (Blocking Experimental Removal)

These must be completed to remove experimental tag from AI Tracing:

1. **Main Introduction Update** - Add AI observability as key feature
2. **Overview Page Creation** - Comprehensive introduction to observability
3. **AI Tracing Simplification** - Move complex configs to reference
4. **Basic Examples** - At least 3 working examples (basic, Langfuse, Braintrust)
5. **Navigation Reorder** - AI Tracing before OTLP Tracing

## Quick Wins (Can Do Immediately)

1. **Add environment tip** for Langfuse in current docs
2. **Update \_meta.tsx** to put AI Tracing before Tracing
3. **Document Default + Cloud exporters** being automatically included
4. **Add Vercel deployment notes** for known issues

## Known Documentation Bugs to Fix

1. Missing information about Default and Cloud exporters being automatically included
2. No mention of how to disable tracing despite user issues (#7813)
3. Vercel deployment issues not documented (#6702)
4. No guidance on filtering unwanted traces (#7727)
5. Missing trace merging documentation for client-side tools (#7175)

## Future Considerations

### When AI Tracing Goes GA

1. Remove experimental tag
2. Add OTLP deprecation notice with migration timeline
3. Update all examples to use AI Tracing only
4. Archive OTLP-specific documentation

### PostHog Exporter

- High user demand (#7508)
- Should be added to priority providers once available
- Include in examples when implemented

## Metrics for Success

- **Primary Goal**: AI Tracing moves out of experimental status
- **User Experience**:
  - 50% reduction in observability-related support issues
  - Clear understanding of which tracing system to use
  - Successful Vercel deployments
- **Adoption Metrics**:
  - Increased usage of Default + Cloud + External pattern
  - More users successfully filtering traces
  - Proper trace merging for client-side tools

## Document Maintenance

### Version Tracking

- Created: January 2025
- Last Updated: January 2025
- Mastra Version: 0.14.0+ (AI Tracing introduced)
- Target: Remove experimental by v0.18.0

### Implementation Checklist

- [ ] Main introduction updated with AI observability
- [ ] Overview.mdx created
- [ ] AI Tracing docs simplified (details moved to reference)
- [ ] Reference section restructured (API focus)
- [ ] Examples section created (5+ examples)
- [ ] Provider guides moved to examples/reference
- [ ] Redirects added to redirects.mjs
- [ ] Navigation reordered (AI Tracing first)
- [ ] Experimental tag removed from AI Tracing
- [ ] Team review completed

---

_Document created: January 2025_
_Last updated: January 2025_
_Author: Mastra Documentation Team_
_Status: Ready for implementation_
