# Agentic Metrics Collection Points in Mastra

This document maps unique agentic metrics to their collection points in Mastra's architecture.

## Architecture Overview

```
Agent.stream()/generate()
    ↓
PrepareStreamWorkflow (memory, tools setup)
    ↓
loop() → workflowLoopStream()
    ↓
AgenticLoopWorkflow (do-while loop)
    ↓
AgenticExecutionWorkflow
    ├── LLMExecutionStep (model call)
    ├── ToolCallStep (tool execution)
    └── Processors (input/output transformation)
```

---

## 1. Reasoning Efficiency Metrics

### Steps Per Task

**Collection Point:** `AgenticLoopWorkflow` (loop/workflows/agentic-loop/index.ts)

```typescript
// The do-while loop tracks accumulated steps
const accumulatedSteps: StepResult<Tools>[] = [];

// Each iteration adds a step
accumulatedSteps.push(currentStep);

// METRIC: accumulatedSteps.length at workflow completion
```

**How to Instrument:**

```typescript
// In agentic-loop/index.ts, emit metric on finish
metrics.recordHistogram('agent_steps_per_task', { agentId }, accumulatedSteps.length);
```

### Tool Selection Accuracy

**Collection Point:** `ToolCallStep` (loop/workflows/agentic-execution/tool-call-step.ts)

```typescript
// Line ~53: Tool lookup happens here
const tool =
  stepTools?.[inputData.toolName] ||
  Object.values(stepTools || {})?.find((t: any) => `id` in t && t.id === inputData.toolName);

// METRIC: Track if tool exists and executes successfully on first selection
```

**How to Instrument:**

```typescript
interface ToolSelectionMetrics {
  toolName: string;
  found: boolean;
  executionSuccess: boolean;
  wasFirstAttempt: boolean; // Track via context
}
```

### Backtracking / Retry Events

**Collection Point:** `TripWire` and Processor retry logic

```typescript
// agent/trip-wire.ts - TripWire with retry: true triggers backtracking
export class TripWire<TMetadata = unknown> extends Error {
  public readonly options: TripWireOptions<TMetadata>;
  // options.retry = true means agent will retry with feedback
}
```

**How to Instrument:**

```typescript
// Track in processor execution
metrics.incrementCounter('agent_backtrack_events', {
  agentId,
  reason: tripwire.processorId,
  type: tripwire.options.retry ? 'retry' : 'abort',
});
```

---

## 2. Goal Completion Metrics

### Finish Reason Analysis

**Collection Point:** Step finish in `AgenticLoopWorkflow`

```typescript
// agentic-loop/index.ts line ~149
const reason = typedInputData.stepResult?.reason;
// Values: 'stop', 'tool-calls', 'length', 'content-filter', 'tripwire', 'retry'
```

**Proposed Metrics:**

```typescript
interface GoalCompletionMetrics {
  finishReason: string;
  stepsToCompletion: number;
  toolCallsUsed: number;
  wasSuccessful: boolean; // 'stop' or completed tool-calls = success
}

// Map finish reasons to goal states
const goalCompleted = ['stop', 'end-turn'].includes(finishReason);
const goalBlocked = ['content-filter', 'tripwire'].includes(finishReason);
const goalIncomplete = ['length', 'max-steps'].includes(finishReason);
```

### StopWhen Condition Tracking

**Collection Point:** `AgenticLoopWorkflow` stopWhen evaluation

```typescript
// Line ~111-123: stopWhen conditions are evaluated
if (rest.stopWhen && typedInputData.stepResult?.isContinued) {
  const conditions = await Promise.all(
    (Array.isArray(rest.stopWhen) ? rest.stopWhen : [rest.stopWhen]).map(condition => {
      return condition({ steps });
    }),
  );
  const hasStopped = conditions.some(condition => condition);
}
```

**How to Instrument:**

```typescript
// Track which condition triggered stop
metrics.incrementCounter('agent_stop_condition_triggered', {
  agentId,
  conditionIndex: conditions.findIndex(c => c),
});
```

---

## 3. Memory & Context Metrics

### Semantic Recall Effectiveness

**Collection Point:** `SemanticRecall` processor in memory

```typescript
// processors/memory/semantic-recall.ts
// Retrieves semantically similar messages from vector store

interface SemanticRecallMetrics {
  queryEmbeddingTimeMs: number;
  resultsReturned: number;
  topSimilarityScore: number;
  averageSimilarityScore: number;
  resultsActuallyUsed: number; // Compare input vs what model referenced
}
```

### Working Memory Utilization

**Collection Point:** `WorkingMemory` processor

```typescript
// processors/memory/working-memory.ts
// Tracks structured state across conversation

interface WorkingMemoryMetrics {
  templateFieldsFilled: number;
  templateFieldsTotal: number;
  utilizationRatio: number; // filled / total
  updatesThisSession: number;
}
```

### Context Window Utilization

**Collection Point:** `loop()` and message handling

```typescript
// Can be calculated from token usage
interface ContextUtilizationMetrics {
  inputTokens: number;
  maxContextTokens: number; // From model config
  utilizationRatio: number;
  historyTokens: number;
  systemPromptTokens: number;
  userMessageTokens: number;
}
```

---

## 4. Human-in-the-Loop Metrics

### Tool Approval Flow

**Collection Point:** `ToolCallStep` with `requireToolApproval`

```typescript
// tool-call-step.ts handles approval suspension
if (requestContext?.get('__mastra_requireToolApproval')) {
  // Tool execution is suspended, waiting for approval
}
```

**Metrics:**

```typescript
interface HumanApprovalMetrics {
  toolCallId: string;
  toolName: string;
  requestedAt: Date;
  respondedAt?: Date;
  approved: boolean;
  waitTimeMs: number;
}

// Track via Agent.approveToolCall() and Agent.declineToolCall()
```

### Suspension/Resume Tracking

**Collection Point:** Workflow suspend/resume mechanism

```typescript
// Suspensions tracked in message metadata
metadata.suspendedTools = {
  [toolName]: { toolCallId, args, type: 'suspension' | 'approval' },
};
```

---

## 5. Guardrail & Safety Metrics

### TripWire Events

**Collection Point:** `TripWire` class and processor execution

```typescript
// Already have TripWire events, need to aggregate
interface GuardrailMetrics {
  tripwireReason: string;
  processorId: string;
  wasRetryable: boolean;
  metadata: unknown; // Processor-specific data
}
```

### Processor Execution Tracking

**Collection Point:** `ProcessorRunner` in processors/runner.ts

```typescript
// Track each processor in the chain
interface ProcessorMetrics {
  processorId: string;
  processorType: 'input' | 'output';
  executionTimeMs: number;
  modified: boolean; // Did it change the content?
  threwTripwire: boolean;
}
```

---

## 6. Multi-Agent Coordination Metrics

### Agent Network Handoffs

**Collection Point:** `networkLoop` in loop/network/index.ts

```typescript
// Network loop coordinates multiple agents
interface AgentHandoffMetrics {
  fromAgentId: string;
  toAgentId: string;
  handoffReason: string;
  contextTokensTransferred: number;
  handoffLatencyMs: number;
}
```

---

## 7. Model-Specific Agentic Metrics

### Reasoning Token Analysis (o1, DeepSeek, etc.)

**Collection Point:** Token usage in step results

```typescript
// Already captured in TokenUsage
interface ReasoningMetrics {
  reasoningTokens: number;
  outputTokens: number;
  reasoningRatio: number; // reasoning / (reasoning + output)
  reasoningTimeMs?: number; // If available from streaming
}
```

### Thinking vs Action Ratio

**Collection Point:** Step analysis

```typescript
// Analyze step content to classify
interface ThinkingActionMetrics {
  thinkingSteps: number; // Steps with only text, no tool calls
  actionSteps: number; // Steps with tool calls
  ratio: number;
}
```

---

## Implementation Strategy

### Phase 1: Instrument Core Loops (Low Effort, High Value)

1. Add step counting in `AgenticLoopWorkflow`
2. Track finish reasons and map to goal states
3. Emit TripWire events as structured metrics

### Phase 2: Tool & Memory Instrumentation

1. Track tool selection and execution success
2. Instrument semantic recall with relevance scores
3. Add context utilization tracking

### Phase 3: Human-in-the-Loop

1. Track approval request/response times
2. Measure suspension durations
3. Calculate human override rates

### Phase 4: Advanced Analytics

1. Agent network coordination metrics
2. Reasoning efficiency scoring
3. Goal progress estimation

---

## Proposed Interface Additions

```typescript
// Add to IMetricsCollector
interface IMetricsCollector {
  // Existing methods...

  // New agentic-specific methods
  recordAgentGoalCompletion(metrics: GoalCompletionMetrics): void;
  recordToolSelection(metrics: ToolSelectionMetrics): void;
  recordGuardrailTrigger(metrics: GuardrailMetrics): void;
  recordHumanIntervention(metrics: HumanInterventionMetrics): void;
  recordMemoryRetrieval(metrics: MemoryRetrievalMetrics): void;
  recordAgentHandoff(metrics: AgentHandoffMetrics): void;
}

// Aggregate metrics interface
interface AgenticRunMetrics extends AgentRunMetrics {
  // Goal completion
  goalCompleted: boolean;
  goalProgress: number; // 0-1
  finishReason: string;

  // Reasoning efficiency
  stepCount: number;
  backtrackCount: number;
  toolSelectionAccuracy: number;

  // Human involvement
  humanEscalations: number;
  humanOverrides: number;
  approvalWaitTimeMs: number;

  // Memory effectiveness
  memoryRetrievalCount: number;
  memoryRelevanceScore: number;
  contextUtilization: number;

  // Safety
  guardrailTriggers: number;
  blockedActions: number;
}
```
