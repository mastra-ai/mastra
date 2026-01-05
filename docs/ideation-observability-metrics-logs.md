# Observability in an Agentic World: Metrics & Logs Ideation

## The Problem Statement

Traditional observability stacks (ELK, Prometheus/Grafana, Datadog, etc.) were built around:

- **Logs**: Text-based event records (errors, warnings, info)
- **Metrics**: Numerical time-series data (counters, gauges, histograms)
- **Traces**: Request lifecycle tracking across distributed systems

These worked well for request/response services where:
- Each request has predictable latency bounds
- Outcomes are deterministic (same input → same output)
- Costs are relatively uniform per request
- Errors are binary (worked or didn't)

**Agentic applications break these assumptions:**
- Agent runs can take seconds to minutes (or hours with human-in-the-loop)
- LLM outputs are non-deterministic by design
- Costs vary wildly based on token usage, model choice, retries
- "Errors" aren't binary—responses can be unhelpful, hallucinated, or off-topic without throwing exceptions
- Agent behavior is emergent—tool selection, reasoning chains, and multi-step execution are unpredictable

---

## Current State in Mastra

### Tracing (What Exists - Relatively Good)

Mastra has solid tracing infrastructure with typed spans:

```typescript
enum SpanType {
  AGENT_RUN,
  MODEL_GENERATION,
  MODEL_STEP,
  MODEL_CHUNK,
  TOOL_CALL,
  MCP_TOOL_CALL,
  WORKFLOW_RUN,
  WORKFLOW_STEP,
  // ... workflow control flow spans
}
```

Each span captures:
- Input/Output data
- Start/End times
- Entity context (agent ID, workflow ID)
- Token usage (input, output, cache details)
- Parent-child relationships

Exporters exist for: Langfuse, Langsmith, Braintrust, Arize, PostHog, OTEL

### Logging (What Exists - Poor)

Current logging is basic console output:
- `ConsoleLogger` with levels: DEBUG, INFO, WARN, ERROR
- Logs are fire-and-forget (no persistence beyond console transport)
- No structured data attached to logs
- No correlation with traces/runs
- Used sparingly in codebase (mostly for warnings about storage not being initialized)

**The logs are "terrible" because:**
1. They're not structured (just string messages)
2. They're not correlated to runs/traces
3. They don't capture the *important* events in agent execution
4. No log aggregation, search, or analysis capabilities
5. No distinction between framework logs and application/agent logs

### Metrics (What Exists - Almost None)

Only token usage is tracked (input/output tokens, cache tokens).
No aggregated metrics, no counters, no histograms.

---

## What Metrics Matter in Agentic Applications?

### 1. **Cost Metrics** (The Most Important New Dimension)

Unlike traditional apps where compute cost is relatively uniform, agentic apps have highly variable costs:

```typescript
interface CostMetrics {
  // Per-execution
  totalCostUSD: number;
  modelCostUSD: number;       // LLM API costs
  toolCostUSD: number;        // External API/tool costs
  
  // Token breakdown (for cost attribution)
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;    // o1-style thinking tokens
  
  // Model breakdown (multi-model scenarios)
  costByModel: Record<string, number>;
  
  // Aggregates (for dashboards)
  costPerAgent: Record<string, number>;
  costPerUser: Record<string, number>;
  costPerThread: Record<string, number>;
}
```

**Why this matters:**
- A single agent run can cost $0.001 or $10 depending on loops, retries, model choice
- Cost runaway is a real risk (infinite loops, verbose responses)
- Attribution is critical (which agent/user/feature is driving costs?)

### 2. **Quality Metrics** (The New "Error Rate")

Traditional error rates don't capture agentic quality:

```typescript
interface QualityMetrics {
  // Eval-based scores (from running scorers)
  avgRelevanceScore: number;
  avgAccuracyScore: number;
  avgHelpfulnessScore: number;
  
  // Implicit quality signals
  toolSuccessRate: number;         // Tools that returned valid results
  humanOverrideRate: number;       // How often humans corrected/overrode
  retryRate: number;               // How often model retried due to issues
  tripWireTriggerRate: number;     // Guardrail violations
  
  // Outcome metrics (if trackable)
  taskCompletionRate: number;      // User confirmed task complete
  abandonmentRate: number;         // User left without resolution
  followUpRate: number;            // Needed additional clarification
  
  // Hallucination/grounding
  citationAccuracy: number;        // For RAG: citations matched sources
  factualGrounding: number;        // Claims verified against context
}
```

### 3. **Latency & Performance Metrics**

Similar to traditional observability but with agent-specific dimensions:

```typescript
interface PerformanceMetrics {
  // Response time
  totalLatencyMs: number;
  timeToFirstToken: number;       // TTFT - critical for streaming UX
  timeToFirstToolCall: number;    // When agent decides to act
  
  // Step breakdown
  modelLatencyMs: number;
  toolExecutionMs: number;
  memoryOperationsMs: number;
  
  // Iteration metrics
  modelStepCount: number;         // How many LLM calls per run
  toolCallCount: number;          // How many tools invoked
  totalIterations: number;        // For agentic loops
  
  // Percentiles (histograms)
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
}
```

### 4. **Behavioral Metrics** (Agent-Specific)

Metrics unique to agent behavior:

```typescript
interface BehavioralMetrics {
  // Decision patterns
  avgToolsUsedPerRun: number;
  toolSelectionDistribution: Record<string, number>;  // Which tools used how often
  reasoningTokenRatio: number;    // Thinking vs output ratio
  
  // Autonomy levels
  humanInLoopRate: number;        // Required human approval
  fullyAutonomousRate: number;    // Completed without intervention
  
  // Memory patterns
  contextUtilization: number;     // % of context window used
  memoryRetrievalHitRate: number; // Semantic recall success
  workingMemorySize: number;      // State carried between runs
  
  // Network/Multi-agent
  agentHandoffRate: number;       // Delegated to other agents
  collaborationDepth: number;     // Agents involved in resolution
}
```

### 5. **Error & Reliability Metrics**

Traditional errors plus agent-specific failures:

```typescript
interface ReliabilityMetrics {
  // Traditional
  errorRate: number;
  errorsByType: Record<string, number>;
  
  // Agent-specific failures
  modelRefusalRate: number;       // Model refused to answer
  toolFailureRate: number;        // Tools errored
  rateLimitHitRate: number;       // Provider rate limits
  timeoutRate: number;            // Runs that timed out
  
  // Graceful degradation
  fallbackUsageRate: number;      // Model fallback triggered
  cacheHitRate: number;           // Semantic cache hits
  
  // Circuit breaker states
  providerHealthStatus: Record<string, 'healthy' | 'degraded' | 'down'>;
}
```

---

## What Logs Matter in Agentic Applications?

Logs in agentic apps need to be **structured**, **correlated**, and **semantic**:

### 1. **Structured Log Events**

Every log should be a typed event:

```typescript
type AgentLogEvent = 
  | { event: 'agent.started'; agentId: string; input: any; threadId?: string }
  | { event: 'agent.completed'; output: any; durationMs: number; cost: number }
  | { event: 'agent.error'; error: AgentError; recoverable: boolean }
  | { event: 'model.request'; model: string; inputTokens: number }
  | { event: 'model.response'; outputTokens: number; finishReason: string }
  | { event: 'tool.called'; toolName: string; input: any }
  | { event: 'tool.result'; toolName: string; output: any; success: boolean }
  | { event: 'memory.retrieved'; strategy: string; messagesCount: number }
  | { event: 'guardrail.triggered'; guardrailId: string; action: 'blocked' | 'warned' }
  | { event: 'decision.made'; decision: string; alternatives: string[] }
  | { event: 'user.feedback'; type: 'thumbsUp' | 'thumbsDown' | 'correction' };
```

### 2. **Log Correlation**

Every log must be correlatable:

```typescript
interface CorrelatedLog {
  // Trace context
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  
  // Entity context
  agentId?: string;
  workflowId?: string;
  threadId?: string;
  userId?: string;
  
  // Session context
  sessionId?: string;
  requestId?: string;
  
  // The actual log
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  message: string;
  data: Record<string, any>;
  timestamp: Date;
}
```

### 3. **Semantic Log Categories**

Logs should be categorized by what they represent:

| Category | Purpose | Examples |
|----------|---------|----------|
| **Lifecycle** | Agent/workflow state transitions | started, completed, suspended, resumed |
| **Decision** | Agent choices and reasoning | tool selected, branch taken, model chosen |
| **Interaction** | External system calls | API called, tool executed, memory queried |
| **Quality** | Quality signals | score computed, feedback received |
| **Resource** | Resource consumption | tokens used, cost incurred, time spent |
| **Error** | Failures and issues | model refused, tool failed, rate limited |
| **Debug** | Detailed debugging info | prompt constructed, context assembled |

### 4. **Log Levels in Agentic Context**

Redefine log levels for agent semantics:

- **DEBUG**: Internal framework operations, prompt assembly, memory operations
- **INFO**: Key lifecycle events (started, completed), tool calls, model requests
- **WARN**: Degraded operations (fallback used, retry triggered, cache miss)
- **ERROR**: Failures that impact the run (tool errors, model refusals, guardrail blocks)

---

## Proposed Architecture

### 1. **Unified Telemetry Pipeline**

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Execution                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │  Spans  │    │  Logs   │    │ Metrics │    │ Events  │      │
│  └────┬────┘    └────┬────┘    └────┬────┘    └────┬────┘      │
│       │              │              │              │            │
│       └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │  Telemetry Core   │                        │
│                    │  (correlation +   │                        │
│                    │   enrichment)     │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
└──────────────────────────────┼───────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
   ┌─────────┐           ┌─────────┐           ┌─────────┐
   │ Storage │           │ Export  │           │ Realtime│
   │ (query) │           │ (OTEL)  │           │ (stream)│
   └─────────┘           └─────────┘           └─────────┘
```

### 2. **Metrics Collection**

```typescript
interface MetricsCollector {
  // Counters
  incrementCounter(name: string, labels: Labels, value?: number): void;
  
  // Gauges
  setGauge(name: string, labels: Labels, value: number): void;
  
  // Histograms
  recordHistogram(name: string, labels: Labels, value: number): void;
  
  // Specialized agent metrics
  recordTokenUsage(usage: TokenUsage): void;
  recordCost(cost: CostBreakdown): void;
  recordLatency(operation: string, durationMs: number): void;
  recordQualityScore(scorer: string, score: number): void;
}

type Labels = {
  agentId?: string;
  workflowId?: string;
  model?: string;
  tool?: string;
  environment?: string;
  [key: string]: string | undefined;
};
```

### 3. **Enhanced Logger**

```typescript
interface AgentLogger {
  // Lifecycle
  agentStarted(agentId: string, input: any): void;
  agentCompleted(agentId: string, output: any, metrics: RunMetrics): void;
  agentError(agentId: string, error: MastraError): void;
  
  // Model operations
  modelRequest(model: string, messages: Message[], options: ModelOptions): void;
  modelResponse(model: string, response: ModelResponse): void;
  
  // Tool operations
  toolCalled(toolName: string, input: any): void;
  toolResult(toolName: string, result: any, success: boolean): void;
  
  // Decisions
  decisionMade(decision: string, context: any): void;
  
  // Generic (for user code)
  debug(message: string, data?: any): void;
  info(message: string, data?: any): void;
  warn(message: string, data?: any): void;
  error(message: string, error?: Error, data?: any): void;
}
```

---

## Implementation Priorities

### Phase 1: Foundation
1. **Structured logging** - Replace console logger with structured event logger
2. **Log correlation** - Attach trace/span IDs to all logs
3. **Basic metrics** - Token usage, latency, error counts per agent

### Phase 2: Agent-Specific
1. **Cost tracking** - Calculate and aggregate costs
2. **Quality metrics** - Integrate with scorers for quality metrics
3. **Behavioral metrics** - Tool usage patterns, decision tracking

### Phase 3: Platform
1. **Metrics exporters** - Prometheus, OTEL, DataDog, CloudWatch
2. **Log aggregation** - Searchable, filterable log storage
3. **Realtime streaming** - WebSocket/SSE for live monitoring
4. **Dashboards** - Pre-built visualizations for common patterns

---

## Key Design Principles

1. **Everything is correlated** - Logs, metrics, traces share context
2. **Low overhead** - Minimal impact on agent execution
3. **Opt-in detail** - Debug verbosity configurable at runtime
4. **Export flexibility** - Support any observability backend
5. **Cost-aware** - Cost tracking is first-class, not afterthought
6. **Quality-aware** - Quality metrics are as important as availability

---

## Open Questions

1. **Sampling strategy** - How to sample high-volume agent traces without losing important signals?
2. **Cost attribution** - How to handle shared costs (context reuse, cached responses)?
3. **Quality baselines** - What quality scores are "good" for different use cases?
4. **Real-time vs batch** - Which metrics need real-time vs batch aggregation?
5. **Privacy/PII** - How to log/trace without capturing sensitive user data?
6. **Multi-tenant** - How to isolate observability in multi-tenant deployments?

---

## Comparison with Traditional Observability

| Aspect | Traditional | Agentic |
|--------|-------------|---------|
| **Latency** | ms-scale | seconds to minutes |
| **Cost** | Compute-uniform | Highly variable per-request |
| **Errors** | Binary (worked/failed) | Spectrum (helpful → harmful) |
| **Output** | Deterministic | Non-deterministic |
| **Behavior** | Predictable | Emergent |
| **Root cause** | Stack traces | Decision chains |
| **Debugging** | Code inspection | Prompt/context analysis |

---

## Summary

The observability stack for agentic applications needs to evolve beyond logs/metrics/traces to include:

1. **Cost as a first-class metric** - Not an afterthought
2. **Quality metrics** - Response quality, not just availability
3. **Behavioral analytics** - Understanding agent decision patterns
4. **Structured, correlated logs** - Queryable, filterable event streams
5. **Agent-aware instrumentation** - Built-in spans for agent primitives

The goal is to answer questions like:
- "Why did this agent run cost $5?" (cost attribution)
- "Why did the agent choose tool X instead of Y?" (decision tracing)
- "What's our average response quality this week?" (quality metrics)
- "Which agents are driving our LLM costs?" (cost by entity)
- "What happened in the 5 seconds before this error?" (correlated logs)
