# Plan / Analysis

Mastra Observability Competitive Analysis: Langfuse Comparison

**Date**: January 19, 2026
**Purpose**: Internal engineering planning for observability feature development
**Scope**: Full product comparison between Mastra and Langfuse observability capabilities

---

## Executive Summary

Mastra has a solid foundation for observability with comprehensive tracing, a mature evaluation framework, and a functional playground UI. However, Langfuse offers several key features that Mastra lacks:

**Critical Gaps:**
1. **Prompt Management System** - Version-controlled prompts with deployment labels
2. **Dataset Management** - Test datasets with structured experiments
3. **Session Tracking** - Multi-turn conversation grouping with session replay
4. **LLM Playground** - Interactive prompt testing with multi-variant comparison
5. **Annotation Queues** - Human labeling workflows for quality assurance
6. **User Feedback Collection** - Built-in thumbs up/down and rating capture
7. **Analytics Dashboards** - Customizable cost/quality/latency dashboards
8. **Live Evaluators** - Real-time evaluation on production traces

---

## 1. Feature Comparison Tables

### 1.1 Tracing & Observability

| Feature | Mastra | Langfuse | Gap Analysis |
|---------|--------|----------|--------------|
| **Trace/Span Hierarchy** | Full | Full | Parity |
| **Span Types** | 16+ types (AGENT_RUN, MODEL_GENERATION, TOOL_CALL, etc.) | Similar (trace, span, generation, event) | Parity |
| **Token Usage Tracking** | Detailed (input/output/cached/audio/image/reasoning) | Detailed with same granularity | Parity |
| **Cost Tracking** | Token counts only | Cost calculation with model pricing | **Gap**: No cost calculation |
| **Latency Tracking** | Start/end times, duration | Same | Parity |
| **Input/Output Capture** | With serialization controls | Same | Parity |
| **Metadata & Tags** | Custom metadata, tags | Same | Parity |
| **Error Tracking** | Domain, category, details | Similar | Parity |
| **Session Tracking** | Thread-based only | Dedicated sessionId with replay | **Gap**: No session replay |
| **User Tracking** | Via resourceId/userId in context | Dedicated userId with analytics | **Gap**: No user-level analytics |
| **Environment Separation** | Via tags/metadata | Dedicated environment filtering | Minor gap |
| **Distributed Tracing** | Trace IDs propagation | Same | Parity |
| **Agent Graph Visualization** | No | Yes | **Gap**: No graph view |
| **Data Masking** | hideInput/hideOutput | Similar | Parity |
| **Sampling** | Always/Never/Ratio/Custom | Similar | Parity |

### 1.2 Prompt Management

| Feature | Mastra | Langfuse | Gap Analysis |
|---------|--------|----------|--------------|
| **Centralized Prompt Storage** | No | Yes | **Critical Gap** |
| **Prompt Versioning** | No | Automatic versioning | **Critical Gap** |
| **Deployment Labels** | No | production/staging labels | **Critical Gap** |
| **Prompt Variables** | No | `{{variable}}` templating | **Critical Gap** |
| **Prompt-to-Trace Linking** | No | Performance by prompt version | **Critical Gap** |
| **Collaborative Editing** | No | Comments, team editing | **Critical Gap** |
| **SDK Prompt Fetching** | No | Cached retrieval with compile() | **Critical Gap** |
| **GitHub Integration** | No | Version control sync | Nice-to-have |

### 1.3 Evaluations & Scoring

| Feature | Mastra | Langfuse | Gap Analysis |
|---------|--------|----------|--------------|
| **LLM-as-Judge Scorers** | 11 built-in scorers | Built-in + Ragas integration | Parity |
| **Code/NLP Scorers** | 6 built-in (Jaccard, sentiment, etc.) | Fewer built-in | Mastra ahead |
| **Custom Scorer Builder** | Pipeline builder pattern | Custom prompt templates | Parity |
| **Score Types** | Numeric only | Numeric, boolean, categorical | **Gap**: Limited score types |
| **Score Storage** | Linked to trace/span | Same | Parity |
| **Batch Evaluation** | runEvals() with concurrency | Similar | Parity |
| **Live/Production Evaluation** | Manual trigger only | Automated live evaluators | **Gap**: No live evaluation |
| **Evaluation Tracing** | Limited | Full trace per evaluation | Minor gap |
| **User Feedback Collection** | No | Thumbs up/down, ratings, implicit | **Critical Gap** |
| **Annotation Queues** | No | Human labeling workflows | **Critical Gap** |
| **Score Analytics** | Basic listing | Dedicated analytics views | **Gap**: Limited analytics |

### 1.4 Datasets & Experiments

| Feature | Mastra | Langfuse | Gap Analysis |
|---------|--------|----------|--------------|
| **Dataset Creation** | No | UI and SDK | **Critical Gap** |
| **Dataset Items** | No | Input/expected output pairs | **Critical Gap** |
| **Dataset Versioning** | No | Automatic versioning | **Critical Gap** |
| **Schema Validation** | No | JSON Schema enforcement | **Critical Gap** |
| **Import from CSV** | No | Yes | **Critical Gap** |
| **Import from Traces** | No | Batch add from production | **Critical Gap** |
| **Experiment Runs** | No | UI and SDK experiments | **Critical Gap** |
| **Experiment Comparison** | No | Side-by-side analysis | **Critical Gap** |
| **Virtual Folders** | No | Slash notation organization | Nice-to-have |

### 1.5 Playground

| Feature | Mastra | Langfuse | Gap Analysis |
|---------|--------|----------|--------------|
| **Prompt Testing** | No | Interactive prompt editor | **Critical Gap** |
| **Multi-Model Comparison** | No | Side-by-side variants | **Critical Gap** |
| **Jump from Trace** | No | "Open in Playground" | **Critical Gap** |
| **Parameter Tuning** | No | Per-variant settings | **Critical Gap** |
| **Tool Calling Testing** | No | Tool definitions | **Critical Gap** |
| **Save to Prompt Management** | No | Bidirectional integration | **Critical Gap** |
| **Variable Substitution** | No | Test different inputs | **Critical Gap** |

### 1.6 Analytics & Dashboards

| Feature | Mastra | Langfuse | Gap Analysis |
|---------|--------|----------|--------------|
| **Trace Listing** | Paginated with filters | Same | Parity |
| **Cost Dashboard** | No | Model cost breakdown | **Critical Gap** |
| **Quality Dashboard** | No | Score trends over time | **Critical Gap** |
| **Latency Dashboard** | No | Performance analytics | **Critical Gap** |
| **Usage/Volume Metrics** | No | Token consumption charts | **Critical Gap** |
| **Custom Dashboards** | No | Fully customizable | **Critical Gap** |
| **Metrics API** | No | Aggregated daily metrics | **Critical Gap** |
| **Third-Party Export** | No (via PostHog integration) | PostHog, Mixpanel native | Minor gap |
| **Version/Release Tracking** | Via tags | Dedicated release tracking | Minor gap |

### 1.7 SDK & API

| Feature | Mastra | Langfuse | Gap Analysis |
|---------|--------|----------|--------------|
| **Python SDK** | No (Node.js only) | Full-featured | Language limitation |
| **TypeScript SDK** | Full | Full | Parity |
| **REST API** | Full | Full | Parity |
| **OpenTelemetry Support** | Export bridge | Native OTel endpoint | Parity |
| **Async Operations** | Yes | Yes | Parity |
| **Context Propagation** | Proxy-based | Context managers | Parity |
| **Decorators** | No | @observe decorator | Nice-to-have |

---

## 2. Detailed Gap Analysis

### 2.1 Prompt Management System

**Current State in Mastra**: No prompt management. Prompts are defined inline in agent/workflow code.

**Langfuse Implementation**:
- **Data Model**: Prompts stored with name, version, content, type (text/chat), labels, metadata
- **Versioning**: Auto-incremented versions on each save, immutable once created
- **Deployment**: Labels (e.g., "production", "staging") determine which version is active
- **SDK Flow**:
  ```typescript
  const prompt = await langfuse.getPrompt("my-prompt", { label: "production" });
  const compiled = prompt.compile({ variable: "value" });
  ```
- **Caching**: Server-side and client-side caching with TTL
- **Linking**: Traces automatically linked to prompt version used

**Technical Requirements for Mastra**:
1. New storage domain: `PromptStorage` with CRUD operations
2. Prompt entity schema: id, name, version, content, type, labels[], metadata, createdAt
3. SDK method: `mastra.getPrompt(name, options)` with caching
4. Compile method with variable substitution
5. Trace attribute: `promptId`, `promptVersion` for linking
6. UI: Prompt editor, version history, label management

### 2.2 Dataset Management & Experiments

**Current State in Mastra**: No dataset management. Evaluations run on ad-hoc data via `runEvals()`.

**Langfuse Implementation**:
- **Dataset Model**: name, description, metadata, items[], schema
- **Item Model**: input (any JSON), expectedOutput, metadata, sourceTraceId, sourceSpanId
- **Versioning**: Each item change creates a new dataset version
- **Schema Validation**: JSON Schema for input and expectedOutput
- **Experiment Model**: datasetId, results[], evaluatorScores[]
- **Experiment Flow**:
  1. Create/select dataset
  2. Define evaluators
  3. Run application against each item
  4. Compare results across runs

**Technical Requirements for Mastra**:
1. New storage domain: `DatasetStorage` and `ExperimentStorage`
2. Dataset schema: id, name, description, inputSchema, outputSchema, metadata
3. DatasetItem schema: id, datasetId, input, expectedOutput, metadata, sourceTraceId
4. Experiment schema: id, datasetId, name, status, results[]
5. ExperimentResult schema: datasetItemId, applicationOutput, scores[], latency
6. SDK methods: `mastra.createDataset()`, `mastra.getDataset()`, `mastra.runExperiment()`
7. UI: Dataset management page, item editor, experiment runner, comparison view

### 2.3 Session Tracking & Replay

**Current State in Mastra**: Thread-based grouping via `threadId` in memory system. No session replay.

**Langfuse Implementation**:
- **Session Model**: sessionId (string), traces[], metadata, startTime, endTime
- **Propagation**: sessionId passed to SDK, inherited by nested spans
- **Session Replay**: UI shows chronological trace timeline
- **Analytics**: Session-level metrics (total cost, latency, token usage)

**Technical Requirements for Mastra**:
1. Add `sessionId` as first-class attribute alongside `threadId`
2. Session storage: id, userId, startTime, endTime, metadata
3. Session-level aggregation in `listTraces()` API
4. UI: Session list view, session replay timeline, session metrics

### 2.4 LLM Playground

**Current State in Mastra**: Agent testing in playground, but no isolated prompt testing.

**Langfuse Implementation**:
- **Multi-Variant**: Side-by-side prompt comparison
- **Model Selection**: Configure different models per variant
- **Parameters**: Temperature, max_tokens, etc. per variant
- **Variables**: Test same prompt with different inputs
- **Tool Calling**: Define tools in JSON schema
- **Integration**: Open from trace, save to prompt management

**Technical Requirements for Mastra**:
1. New playground route: `/playground/prompts`
2. Prompt editor component with syntax highlighting
3. Model selector with provider/model configuration
4. Parameter controls (temperature, max_tokens, etc.)
5. Variable input fields with JSON support
6. Multi-variant comparison layout
7. "Open in Playground" button on trace/span details
8. "Save as Prompt" action to prompt management

### 2.5 User Feedback Collection

**Current State in Mastra**: No built-in user feedback. Manual scoring only.

**Langfuse Implementation**:
- **Feedback Types**: Binary (thumbs), numeric (1-5 stars), text (comments)
- **Collection**: Frontend SDK method `langfuse.score({ traceId, name, value })`
- **Implicit Signals**: Time on page, copy actions, retries
- **Storage**: Scores linked to traces with source="USER"

**Technical Requirements for Mastra**:
1. Score source enum: "SCORER" | "USER" | "ANNOTATION"
2. SDK method: `mastra.submitFeedback({ traceId, type, value, comment })`
3. Client-side SDK for browser feedback submission
4. UI: Feedback widgets embeddable in applications
5. Analytics: Feedback trends, correlation with other scores

### 2.6 Annotation Queues

**Current State in Mastra**: Manual scoring via playground UI on individual spans.

**Langfuse Implementation**:
- **Queue Model**: name, filters (trace name, tags, etc.), scoreConfigs[]
- **Workflow**: Annotators pull next item, review trace, submit scores
- **Score Configs**: Predefined score categories (relevance, quality, etc.)
- **Progress Tracking**: Items reviewed, pending, completion %

**Technical Requirements for Mastra**:
1. AnnotationQueue schema: id, name, filters, scoreConfigs[], status
2. AnnotationTask schema: queueId, traceId, spanId, assignee, status, scores[]
3. Queue management API: create, list, assign, complete
4. UI: Queue list, annotation interface, progress dashboard

### 2.7 Live Evaluators

**Current State in Mastra**: Evaluations triggered manually or via `scoreTraces()`.

**Langfuse Implementation**:
- **Evaluator Config**: filters (trace name, tags), scorer, variable mapping
- **Execution**: New traces matching filter auto-evaluated
- **Sampling**: Configurable % to manage costs
- **Backfill**: Option to evaluate existing traces

**Technical Requirements for Mastra**:
1. LiveEvaluator schema: id, name, filters, scorerId, variableMapping, sampling
2. Background worker: Poll/subscribe for new traces, run evaluations
3. Execution tracing: Each evaluation creates its own trace
4. UI: Evaluator configuration, status monitoring, enable/disable

### 2.8 Analytics Dashboards

**Current State in Mastra**: Trace list with filters only. No aggregated analytics.

**Langfuse Implementation**:
- **Metrics**: Token usage, costs, latency, score averages
- **Dimensions**: Time, model, user, session, trace name, tags
- **Charts**: Line charts, bar charts, tables
- **Custom Dashboards**: Drag-and-drop widget layout
- **Metrics API**: Programmatic access to aggregated data

**Technical Requirements for Mastra**:
1. Aggregation queries in storage layer (by time, entity, user)
2. Metrics API endpoints: `/api/analytics/tokens`, `/api/analytics/costs`, etc.
3. Cost calculation service (model pricing configuration)
4. Dashboard UI: Chart components, date range selector, dimension filters
5. Custom dashboard: Saveable widget layouts

### 2.9 Cost Tracking

**Current State in Mastra**: Token counts tracked, no cost calculation.

**Langfuse Implementation**:
- **Model Pricing**: Configurable input/output prices per model
- **Pricing Tiers**: Different rates based on token thresholds
- **Cost Calculation**: Automatic based on usage + pricing
- **Analytics**: Cost breakdown by model, user, feature

**Technical Requirements for Mastra**:
1. ModelPricing schema: modelId, inputPrice, outputPrice, tiers[]
2. Default pricing for common models (OpenAI, Anthropic, etc.)
3. Cost calculation on trace ingest or query time
4. Add `cost` field to span attributes
5. UI: Model pricing configuration, cost analytics

---

## 3. Priority Recommendations

### Tier 1: High Impact, Foundation Features (Recommended First)

#### 1. Prompt Management System
**Priority**: Critical
**Effort**: Medium (2-3 weeks)
**Rationale**: Foundation for playground and experiments. High user value for managing prompts across environments.

#### 2. LLM Playground
**Priority**: Critical
**Effort**: Medium (2-3 weeks)
**Rationale**: High developer productivity. Natural extension of existing playground.

#### 3. Dataset Management
**Priority**: Critical
**Effort**: Medium-High (3-4 weeks)
**Rationale**: Enables systematic testing. Foundation for experiments.

### Tier 2: High Impact, Build on Foundation

#### 4. Experiment Runner
**Priority**: High
**Effort**: Medium (2-3 weeks)
**Rationale**: Completes dataset value proposition. CI/CD integration potential.

#### 5. Analytics Dashboards
**Priority**: High
**Effort**: Medium-High (3-4 weeks)
**Rationale**: High visibility feature. Differentiator for studio.

#### 6. User Feedback Collection
**Priority**: High
**Effort**: Low-Medium (1-2 weeks)
**Rationale**: Easy win. Complements existing scoring.

### Tier 3: Medium Impact, Nice-to-Have

#### 7. Session Tracking
**Priority**: Medium
**Effort**: Low-Medium (1-2 weeks)
**Rationale**: Useful for multi-turn apps. Extends existing threadId concept.

#### 8. Live Evaluators
**Priority**: Medium
**Effort**: Medium (2-3 weeks)
**Rationale**: Advanced feature. Requires background processing infrastructure.

#### 9. Annotation Queues
**Priority**: Medium
**Effort**: Medium (2-3 weeks)
**Rationale**: Enterprise feature. Lower priority for initial release.

### Tier 4: Lower Priority

#### 10. Agent Graph Visualization
**Priority**: Low
**Effort**: Medium (2-3 weeks)
**Rationale**: Nice visual feature but not core functionality.

#### 11. Python SDK
**Priority**: Low
**Effort**: High (4+ weeks)
**Rationale**: Large effort. Node.js/TypeScript covers most Mastra users.

---

## 4. Technical Architecture Recommendations

### 4.1 New Storage Domains

```
packages/core/src/storage/domains/
├── observability/      # Existing
├── prompts/            # NEW: Prompt management
│   ├── types.ts
│   ├── schema.ts
│   └── index.ts
├── datasets/           # NEW: Datasets & experiments
│   ├── types.ts
│   ├── schema.ts
│   └── index.ts
└── analytics/          # NEW: Aggregated metrics
    ├── types.ts
    └── index.ts
```

### 4.2 New Playground Routes

```
packages/playground/src/pages/
├── observability/
│   ├── index.tsx           # Traces list (existing)
│   ├── playground.tsx      # NEW: LLM Playground
│   ├── prompts/            # NEW: Prompt management
│   │   ├── index.tsx
│   │   └── [promptId].tsx
│   ├── datasets/           # NEW: Dataset management
│   │   ├── index.tsx
│   │   └── [datasetId].tsx
│   ├── experiments/        # NEW: Experiments
│   │   ├── index.tsx
│   │   └── [experimentId].tsx
│   └── analytics/          # NEW: Dashboards
│       └── index.tsx
```

### 4.3 API Endpoint Structure

```
/api/prompts
  GET    /                     # List prompts
  POST   /                     # Create prompt (new version)
  GET    /:name                # Get prompt by name (latest or by label)
  GET    /:name/versions       # List versions
  PUT    /:name/labels         # Update labels

/api/datasets
  GET    /                     # List datasets
  POST   /                     # Create dataset
  GET    /:id                  # Get dataset with items
  POST   /:id/items            # Add items
  PUT    /:id/items/:itemId    # Update item
  DELETE /:id/items/:itemId    # Archive item

/api/experiments
  GET    /                     # List experiments
  POST   /                     # Create/run experiment
  GET    /:id                  # Get experiment results
  GET    /:id/compare          # Compare with other experiments

/api/analytics
  GET    /tokens               # Token usage over time
  GET    /costs                # Cost breakdown
  GET    /latency              # Latency metrics
  GET    /scores               # Score trends
```

### 4.4 Schema Additions

**Prompt Schema**:
```typescript
interface Prompt {
  id: string;
  name: string;
  version: number;
  type: 'text' | 'chat';
  content: string | ChatMessage[];
  labels: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  createdBy?: string;
}
```

**Dataset Schema**:
```typescript
interface Dataset {
  id: string;
  name: string;
  description?: string;
  inputSchema?: JSONSchema;
  outputSchema?: JSONSchema;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface DatasetItem {
  id: string;
  datasetId: string;
  version: number;
  input: unknown;
  expectedOutput?: unknown;
  metadata: Record<string, unknown>;
  sourceTraceId?: string;
  sourceSpanId?: string;
  status: 'active' | 'archived';
  createdAt: Date;
}
```

**Experiment Schema**:
```typescript
interface Experiment {
  id: string;
  datasetId: string;
  name: string;
  description?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  config: ExperimentConfig;
  results: ExperimentResult[];
  startedAt?: Date;
  completedAt?: Date;
}

interface ExperimentResult {
  datasetItemId: string;
  output: unknown;
  latencyMs: number;
  tokenUsage: TokenUsage;
  cost?: number;
  scores: Score[];
  traceId: string;
}
```

---

## 5. Out of Scope Considerations

The following features are explicitly **out of scope** for this analysis but may warrant future investigation:

1. **Self-hosted deployment** - Mastra is framework-focused, not a hosted platform
2. **Multi-tenancy** - Enterprise feature, lower priority
3. **RBAC/Permissions** - Enterprise feature, lower priority
4. **Data export to S3** - Can be added later if needed
5. **MCP Server integration** - Specialized use case
6. **GitHub prompt sync** - Nice-to-have, not critical

---

## 6. Success Metrics

After implementing the recommended features, track:

1. **Adoption**: % of Mastra users enabling observability
2. **Engagement**: Traces per project, scores per trace
3. **Prompt Management**: Prompts created, versions deployed
4. **Experiments**: Experiment runs, datasets created
5. **Feedback**: User feedback submissions

---

## 7. Next Steps

1. **Review this document** with engineering team
2. **Prioritize Tier 1 features** for initial development
3. **Create detailed technical specs** for each feature
4. **Estimate effort** and assign to sprints
5. **Begin implementation** with Prompt Management or LLM Playground

---

## Appendix A: Langfuse Feature Reference URLs

- Tracing: https://langfuse.com/docs/tracing
- Prompts: https://langfuse.com/docs/prompts
- Evaluations: https://langfuse.com/docs/scores
- Datasets: https://langfuse.com/docs/datasets
- Playground: https://langfuse.com/docs/playground
- Analytics: https://langfuse.com/docs/analytics
- GitHub Repository: https://github.com/langfuse/langfuse

## Appendix B: Mastra Current Observability Files

- Core observability: `/packages/core/src/observability/`
- Storage domain: `/packages/core/src/storage/domains/observability/`
- Exporters: `/observability/` (langfuse, otel, braintrust, etc.)
- Evals package: `/packages/evals/`
- Playground UI: `/packages/playground-ui/src/domains/observability/`
- Server handlers: `/packages/server/src/server/handlers/observability.ts`
