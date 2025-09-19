# AI Trace Scoring Feature Plan

## Overview

Enable users to run scorers (evaluators) on AI Traces in the Mastra framework. Users will be able to evaluate both historical and live traces using configurable filters and sampling to assess AI agent and workflow performance.

## User Journeys

### Historical Trace Scoring (UI-Driven, Ad-Hoc)

#### Journey 1: Manual Trace Selection + UI

1. **Browse Traces**
   - User browses traces in the UI (any filter state)
   - Each trace row has a checkbox

2. **Select Specific Traces**
   - User manually checks interesting traces:
     - ✅ Trace A (failed agent interaction)
     - ✅ Trace B (slow response)
     - ✅ Trace C (successful but complex)
   - Selection counter shows: "3 traces selected"

3. **Score Selected Traces**
   - Click "Score Selected" button
   - Same scoring configuration modal as Journey 1
   - Preview: "This will score 3 selected traces"

4. **View Results**
   - Selected traces show scores immediately after completion
   - Can export results or add to analysis dashboard

#### Journey 2: Date Range + Filter Scoring

1. **Navigate to Traces Page**
   - User opens the "Traces" section in Mastra UI
   - Views list of traces with filtering controls

2. **Apply Filters**
   - Select date range: "Last 7 days" or custom range
   - Filter by entity type: "Agent" or "Workflow"
   - Filter by entity name: e.g., "customer-support-agent"
   - Filter by span type: e.g., "agent_run" spans only
   - See filtered trace list update in real-time

3. **Configure Scoring**
   - Click "Run Scorer" button above trace list
   - Modal opens with scoring configuration:
     - Select scorer from dropdown (e.g., "Relevance Scorer")
     - Choose scope: "Score entire trace" vs "Score individual spans"
     - Set sampling rate: 30% slider
   - Preview: "This will score ~150 traces"

4. **Execute Scoring**
   - Click "Start Scoring"
   - Immediate confirmation: "Scoring started for ~150 traces"
   - Modal closes, scoring runs in background
   - No progress tracking for MVP

5. **View Results**
   - Results appear in trace list as scoring completes
   - Refresh page to see latest scored traces
   - Click on individual trace to see detailed scoring results
   - Navigate to "Scorer Results" page for aggregated analysis

### Live Trace Scoring (Config-Driven, Continuous)

#### Journey 3: Set Up Live Scoring

1. **Navigate to Live Scoring Config**
   - User opens "Scorer Configurations" page
   - Views list of active/inactive live scoring configurations

2. **Create New Configuration**
   - Click "New Live Scorer"
   - Configuration form:
     - **Name**: "Production Agent Quality Monitor"
     - **Scorer**: Select "Accuracy Scorer"
     - **Scope**: "Score entire trace" (for agent_run spans)
     - **Filters**:
       - Entity Type: "Agent"
       - Entity Name: "production-support-agent"
       - Span Type: "agent_run"
     - **Sampling**: 10% (to manage costs)

3. **Activate Live Scoring**
   - Toggle "Active" switch
   - Confirmation: "This will start scoring new traces matching your filters"
   - Configuration status changes to "Active"

4. **Monitor Live Results**
   - Dashboard shows live scoring metrics
   - Can view recent scored traces
   - Alerts if scoring patterns change significantly

#### Journey 4: Data sets - follow up

- run a dataset on a agent/workflow with a set of scorers

## Current State Analysis

### Existing Infrastructure

- **Scorer System**: Robust scorer implementation in `base.ts` with pipeline support
- **Real-time Scoring**: Currently scores agents/workflows via hooks (`hooks.ts`, `mastra/hooks.ts`)
- **Data Storage**:
  - `mastra_scorers` table stores scorer results
  - `mastra_ai_spans` table stores trace data with rich metadata
- **Sampling Logic**: Percentage-based sampling already implemented

### Data Model Assessment

**AI Spans Structure** (`mastra_ai_spans`):

- ✅ `traceId`, `spanId`, `parentSpanId` for relationships
- ✅ `spanType` for filtering (agent_run, workflow_run, llm_generation, tool_call)
- ✅ `input`/`output` for scorer evaluation
- ✅ `attributes` with entity metadata (agentId, workflowId, etc.)
- ✅ Timestamps for historical querying

**Current Scorer Results** (`mastra_scorers`):

- ✅ Has `entityType`, `entityId`, `traceId`
- ❌ Missing direct `spanId` linkage
- ✅ Already supports sampling and metadata

## Required Changes

### 1. Data Model Updates

// We can have a traceid + spanid to skip migration for now.

#### A. Extend `mastra_scorers` table

```typescript
// Add to SCORERS_SCHEMA in storage/constants.ts
spanId: {
  type: 'text',
  nullable: true, // for backward compatibility
}
```

// Skip for now, we can have the config on the scorers config on the mastra instance for now.

#### B. Live scoring configuration table `mastra_trace_scorer_configs`

```typescript
{
  id: { type: 'text', primaryKey: true },
  name: { type: 'text' }, // user-friendly name
  scorerId: { type: 'text' }, // which scorer to use

  // Scope configuration
  scopeType: { type: 'text' }, // 'trace' | 'span'

  // Live scoring filters
  entityTypeFilter: { type: 'text', nullable: true }, // 'AGENT' | 'WORKFLOW'
  entityNameFilter: { type: 'text', nullable: true }, // specific agent/workflow name
  spanTypeFilter: { type: 'text', nullable: true }, // 'agent_run', 'workflow_run', 'workflow_step', etc.

  // Sampling
  samplingRate: { type: 'float' }, // 0.0 to 1.0

  // Status
  isActive: { type: 'boolean' },

  // Metadata
  createdAt: { type: 'timestamp' },
  updatedAt: { type: 'timestamp' }
}
```

#### C. No additional job tracking needed for MVP

**Decision**: Fire-and-forget approach for historical trace scoring

- No job tracking table required initially
- Ultra-simple implementation for MVP validation
- Can add job tracking later if needed for larger datasets

### 2. API Endpoints

#### Live Scoring Configuration (Config-driven)

```
POST   /api/trace-scorers/configs           - Create live scoring configuration
GET    /api/trace-scorers/configs           - List live scoring configurations
GET    /api/trace-scorers/configs/:id       - Get specific configuration
PUT    /api/trace-scorers/configs/:id       - Update configuration
DELETE /api/trace-scorers/configs/:id       - Delete configuration
```

#### Historical Scoring (UI-driven, fire-and-forget)

```
POST /api/trace-scorers/batch               - Run scorer on historical traces (fire-and-forget)
```

**API Design:**

```typescript
POST /api/trace-scorers/batch
{
  "scorerId": "accuracy-scorer",
  "scopeType": "trace", // or "span"
  "filters": {
    "timeRange": { "start": "2024-01-01", "end": "2024-01-07" },
    "entityType": "AGENT",
    "entityName": "customer-support-agent",
    "spanType": "agent_run"
  },
  "samplingRate": 0.2
}

// OR manual trace selection:
{
  "scorerId": "relevance-scorer",
  "scopeType": "span",
  "traceIds": ["trace-123", "trace-456"],
  "spanIds": ["span-abc", "span-def"] // optional
}

// Response (immediate):
{
  "message": "Scoring started for ~1200 traces",
  "estimatedTotal": 1200,
  "status": "initiated"
}
```

#### Results Access

```
GET /api/traces/:traceId/scores             - Get scores for specific trace
GET /api/spans/:spanId/scores               - Get scores for specific span
GET /api/scorers/:scorerId/trace-results    - Get all trace scoring results for scorer
```

### 3. Implementation Components (MVP Phase 1)

#### A. Data Model Extensions

**File**: `packages/core/src/storage/constants.ts`

- Add `spanId` field to `SCORERS_SCHEMA`
- Add `TABLE_TRACE_SCORER_CONFIGS` schema
- Extend storage interfaces for span querying

#### B. Live Scoring Configuration Manager (`trace-scorer-config.ts`)

- CRUD operations for live scoring configurations
- Validation of scorer availability and filters
- Active configuration retrieval for hook system

#### C. Live Scoring Hook Extension (`live-trace-scorer.ts`)

- Extend existing hook system from `scores/hooks.ts`
- `onSpanComplete()` function to trigger on AI span creation
- Filter matching logic for span types/entities
- Integration with existing `runScorer()` pattern

#### D. Historical Batch Scorer (`historical-trace-scorer.ts`)

- Query spans based on filters or explicit trace/span IDs
- Apply sampling to query results before processing
- Fire-and-forget batch execution of scorers
- Context building for trace-level scoring (fetch trace hierarchy)
- Error logging without job tracking

#### E. Trace Scoring Service (`trace-scoring-service.ts`)

- Unified interface for both live and historical scoring
- Coordinate scorer execution with proper context
- Result storage with `spanId` linkage
- Background processing coordination

#### F. API Endpoints (`trace-scorer-api.ts`)

- `POST /api/trace-scorers/batch` - Historical scoring
- Live config CRUD endpoints
- Results retrieval endpoints

#### G. Storage Interface Extensions

- Add span querying methods to `MastraStorage`
- Trace hierarchy building for context
- Batch span retrieval with sampling

## Implementation Strategy

### Phase 1: Foundation (MVP) - Both Historical AND Live Scoring

1. **Data Model**: Add `spanId` to scorers table, create live config table
2. **Historical Scoring**: Fire-and-forget batch processing API
3. **Live Scoring**: Span completion hook + configuration system
4. **Results API**: Basic endpoints to retrieve scoring results
5. **UI Integration**: Both historical controls and live config management

### Phase 2: Enhanced Experience

1. **Job Queue System**: Add progress tracking for historical scoring
2. **Real-time Updates**: WebSocket/SSE for live results
3. **Advanced UI**: Better dashboards and result visualization

### Phase 3: Advanced Features

1. **Advanced Filtering**: Time ranges, custom attribute filters
2. **Scoring Pipelines**: Chain multiple scorers
3. **Performance Optimization**: Caching, batch optimizations
4. **Analytics Dashboard**: Aggregated metrics and trends

## Key Design Decisions - RESOLVED

### 1. Performance Approach ✅

**Decision**: Fire-and-forget for MVP

- Historical scoring runs in background without job tracking
- Immediate API response with estimated count
- Ultra-simple implementation for rapid MVP validation
- Can upgrade to job queue system later if needed

### 2. Sampling Strategy ✅

**Decision**: Sample queries before scoring

- Apply sampling to database queries for efficiency
- Reduces computational load and costs
- More efficient than scoring everything then sampling results

### 3. Span Type Scoring ✅

**Decision**: Yes, full span type filtering support

**Span Types Available**:

- `agent_run` - Complete agent execution
- `workflow_run` - Complete workflow execution
- `workflow_step` - Individual workflow step
- `llm_generation` - LLM API calls
- `tool_call` - Individual tool executions

### 4. Scoring Scope ✅

**Decision**: Flexible scope selection - both traces and individual spans

- **Trace-level scoring**: For `agent_run` spans, include full trace context
- **Span-level scoring**: For specific spans like `workflow_step`
- **UI-driven**: Users specify scope when triggering scoring

**Implementation**:

- `scopeType: 'trace' | 'span'` in API requests
- When `scopeType: 'trace'`, fetch entire trace hierarchy for context
- When `scopeType: 'span'`, score individual span in isolation

### 5. Historical vs Live Scoring ✅

**Decision**: Separate workflows with different purposes

- **Historical**: UI-driven, ad-hoc analysis, no configuration needed
- **Live**: Configuration-driven, continuous background processing

## Integration Points

### Existing Scorer System

- **Leverage**: Existing `MastraScorer` class and pipeline system
- **Extend**: Add trace-specific context to scorer runs
- **Reuse**: Sampling logic from `scores/hooks.ts`

### Live Scoring Hook Integration

**Key Integration Point**: Hook into AI span completion events

**Current Hook System** (packages/core/src/scores/hooks.ts):

- `runScorer()` function handles real-time agent/workflow scoring
- Already has sampling logic and async execution
- Stores results in `mastra_scorers` table

**New Trace Scoring Hook**:

```typescript
// When spans are written to mastra_ai_spans table
// New hook: onSpanComplete(spanData)
export function onSpanComplete(spanData: AISpanData) {
  const activeConfigs = getActiveTraceScorConfigs();

  for (const config of activeConfigs) {
    if (matchesSpanFilters(spanData, config)) {
      if (shouldSample(config.samplingRate)) {
        executeTraceScoringAsync(config, spanData);
      }
    }
  }
}
```

**Integration Strategy**:

1. **Extend existing hook system** rather than create new one
2. **Reuse existing sampling/execution logic** from current scorer hooks
3. **Same result storage pattern** - just add `spanId` field

### Storage Integration

- **Extend**: Current `MastraStorage` interface with trace querying methods
- **Reuse**: Existing scorer result storage pattern
- **Add**: Span querying for historical batch processing

### UI Integration

- **Extend**: Current scorer management pages
- **Add**: Trace-specific configuration and results views
- **Reuse**: Existing scorer result display components

## Success Metrics

### Functional

- ✅ Can configure scoring for specific entity types/names
- ✅ Can score historical traces with sampling
- ✅ Can score live traces as they arrive
- ✅ Can view results in UI and access via API
- ✅ Scorer results correctly linked to traces/spans

### Non-Functional

- ⚡ Historical scoring completes within reasonable time (< 30s for 1000 traces)
- 🔄 Live scoring doesn't impact trace ingestion performance
- 📊 Results accessible within 5s of scoring completion

## Risk Mitigation

### Performance Risks

- **Risk**: Large historical datasets cause timeouts
- **Mitigation**: Implement batch size limits and pagination

### Data Integrity Risks

- **Risk**: Scorer results incorrectly associated with traces
- **Mitigation**: Strict validation of traceId/spanId relationships

### Backward Compatibility Risks

- **Risk**: Changes break existing scorer functionality
- **Mitigation**: Additive-only schema changes, feature flags

## Next Steps

1. **Review and validate this plan** with stakeholder feedback
2. **Answer key design questions** above
3. **Create detailed technical specification** for Phase 1
4. **Set up development environment** and begin implementation
5. **Create test suite** with trace scoring scenarios
