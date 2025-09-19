# Paris Plan - Trace Scoring MVP (First Iteration)

## Goal

Enable users to manually select traces from the observability page and run scorers on them, with bidirectional linking between traces and scoring results.

## Success Criteria

- ✅ Select individual traces from observability UI
- ✅ UI to choose available scorers for selected traces
- ✅ Execute scoring and store results linked to traces
- ✅ Display scores in trace detail view
- ✅ Display trace links in scorer results view

## Core User Journey

### Manual Trace Scoring Workflow

1. **Navigate to Observability/Traces Page**
   - User opens existing traces page in Mastra UI
   - Views list of traces with existing filtering

2. **Select Traces for Scoring**
   - Each trace row has a checkbox ✅
   - User selects 1-N traces of interest
   - Selection counter: "3 traces selected"

3. **Choose Scorer**
   - Click "Score Selected" button
   - Modal opens with single scorer selection:
     - Dropdown of available scorers (single selection)
     - Brief description of selected scorer
     - Preview: "Score 3 traces with Relevance Scorer"

4. **Execute Scoring**
   - Click "Run Scorer"
   - Modal shows "Scoring started..." then closes
   - Fire-and-forget execution in background

5. **View Results**
   - **In Trace View**: Each trace shows scoring results inline
   - **In Scorer Results**: New page showing all scoring results with links back to traces

## Technical Implementation

### Data Model Changes (Minimal)

#### A. Extend existing `mastra_scorers` table

```typescript
// Add to SCORERS_SCHEMA in storage/constants.ts
spanId: {
  type: 'text',
  nullable: true, // for backward compatibility
}
```

**No new tables needed** - Keep it simple for Paris Plan.

### API Design

#### Single API Endpoint

```typescript
POST /api/trace-scorers/batch
{
  "scorerId": "relevance-scorer", // Single scorer only
  "traceIds": ["trace-123", "trace-456", "trace-789"],
  "scopeType": "trace" // Always score full trace for Paris Plan
}

// Response (immediate):
{
  "message": "Scoring started for 3 traces",
  "traceCount": 3,
  "status": "initiated"
}
```

#### Results API (Existing, extend)

```typescript
GET /api/traces/:traceId/scores    - Get scores for specific trace
GET /api/scorers/:scorerId/results - Get all results for scorer (with trace links)
```

### Implementation Components

#### 1. UI Components (Frontend)

```typescript
// TraceListPage.tsx - Add selection capability
- Add checkboxes to trace rows
- Add "Score Selected" button
- Track selected trace IDs

// ScoringSelectorModal.tsx - New component
- Single scorer dropdown (fetch from Mastra instance)
- Preview selected traces + chosen scorer
- Execute scoring API call for one scorer

// TraceDetailPage.tsx - Extend existing
- Display scoring results for this trace
- Link to scorer results page

// ScorerResultsPage.tsx - New page
- List all scoring results
- Link back to original traces
- Filter by scorer type
```

#### 2. Backend API

```typescript
// trace-scorer-api.ts - New API handler
async function batchScoreTraces(request) {
  const { scorerId, traceIds } = request.body;

  // Validate scorer exists
  const scorer = mastra.getScorerByName(scorerId);
  if (!scorer) throw new Error('Scorer not found');

  // Fire and forget - no job tracking
  processTraceScoring(scorer, traceIds).catch(console.error);

  return {
    message: `Scoring started for ${traceIds.length} traces`,
    traceCount: traceIds.length,
    status: 'initiated',
  };
}
```

#### 3. Scoring Processor

```typescript
// trace-scoring-processor.ts - Background scoring
async function processTraceScoring(scorer, traceIds) {
  for (const traceId of traceIds) {
    try {
      // Get trace data from mastra_ai_spans
      const traceSpans = await getTraceHierarchy(traceId);
      const mainSpan = findMainSpan(traceSpans); // agent_run or workflow_run

      // Build scoring context
      const scoringInput = {
        runId: traceId,
        input: mainSpan.input,
        output: mainSpan.output,
        traceId: traceId,
        spanId: mainSpan.spanId,
      };

      // Run scorer
      const result = await scorer.run(scoringInput);

      // Store result with trace linkage
      await mastra.storage.saveScore({
        ...result,
        traceId,
        spanId: mainSpan.spanId,
        scorerId: scorer.name,
      });
    } catch (error) {
      console.error(`Failed to score trace ${traceId}:`, error);
    }
  }
}
```

#### 4. Storage Extensions

```typescript
// Extend MastraStorage interface
interface MastraStorage {
  // Existing methods...

  // New methods for Paris Plan
  getTraceHierarchy(traceId: string): Promise<AISpan[]>;
  getScoresByTraceId(traceId: string): Promise<ScorerResult[]>;
  getScoresByScorerName(scorerName: string): Promise<ScorerResult[]>;
}
```

## Implementation Order

### Week 1: Backend Foundation

1. **Data Model**: Add `spanId` to scorers schema
2. **Storage**: Implement trace querying methods
3. **API**: Create batch scoring endpoint
4. **Processor**: Background scoring execution

### Week 2: UI Integration

1. **Trace Selection**: Add checkboxes to trace list
2. **Scorer Modal**: Build scorer selection component
3. **Results Display**: Show scores in trace detail view
4. **Results Page**: Create scorer results page with trace links

### Week 3: Polish & Testing

1. **Error Handling**: Graceful failure modes
2. **UI Polish**: Loading states, confirmations
3. **Testing**: Manual testing of full workflow
4. **Documentation**: Basic usage guide

## What's NOT in Paris Plan (Future Iterations)

❌ **Live/Continuous Scoring** - Only manual trace selection
❌ **Complex Filtering** - Use existing trace page filters
❌ **Progress Tracking** - Fire and forget only
❌ **Configuration Management** - Direct single scorer selection only
❌ **Multi-Scorer Batches** - One scorer per batch operation
❌ **Sampling** - Score all selected traces
❌ **Span-Level Scoring** - Full trace scoring only

## Success Metrics

### Functional Validation

- ✅ Can select 1-10 traces from observability page
- ✅ Can choose any available scorer from dropdown
- ✅ Scoring executes without blocking UI
- ✅ Results appear in trace detail view within 30 seconds
- ✅ Can navigate from trace to scoring results and back

### Technical Validation

- ✅ `spanId` properly linked to scoring results
- ✅ No performance impact on trace ingestion
- ✅ Graceful handling of scorer failures
- ✅ Results persist correctly in database

## Risk Mitigation

### Low Risk Approach

- **Reuse Existing**: Extend current trace UI rather than rebuild
- **Single Scorer**: One scorer per batch to keep logic simple
- **Fire-and-Forget**: No complex job management
- **Manual Only**: No automatic triggers to debug

### Fallback Plan

If complex trace hierarchy is problematic:

- **Simple Version**: Score only the main span (agent_run/workflow_run)
- **Flat Context**: Pass just input/output without full trace context

## Next Steps

1. ✅ **Validate Plan**: Confirm this meets immediate user needs
2. 🚀 **Start Implementation**: Begin with backend data model changes
3. 📋 **Create Tasks**: Break down Week 1 items into specific development tasks
4. 🧪 **Setup Testing**: Prepare test traces and scorers for validation

This Paris Plan delivers immediate value while keeping implementation simple and low-risk!
