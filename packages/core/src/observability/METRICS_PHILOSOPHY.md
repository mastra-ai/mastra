# Observability for Agentic Applications: A New Paradigm

## The Fundamental Shift

Traditional software is **deterministic** - the same input produces the same output.
Agentic software is **stochastic** - the same input can produce different outputs.

This changes everything about how we measure quality.

---

## Traditional → Agentic Metric Mapping

### 1. LATENCY

**Traditional:** Response time (P50, P95, P99)

```
Request → Process → Response
   └────── time ──────┘
```

**Agentic:** Multi-dimensional latency

```
Request → Think → Tool → Think → Tool → Think → Response
   │         │      │       │      │       │        │
   └─ TTFT ──┘      │       │      │       │        │
   └───── Time to First Action ────┘       │        │
   └────────── Time to Resolution ─────────────────┘
```

| Traditional Metric | Agentic Equivalent               | Why It Matters                           |
| ------------------ | -------------------------------- | ---------------------------------------- |
| Response time      | **Time to First Token (TTFT)**   | User perceives responsiveness            |
| -                  | **Time to First Action**         | When agent actually does something       |
| -                  | **Time to Resolution**           | Total time to complete goal              |
| -                  | **Thinking time vs Acting time** | Is the agent stuck thinking?             |
| P99 latency        | **Step count variability**       | Why did this take 10 steps instead of 2? |

### 2. THROUGHPUT

**Traditional:** Requests per second, concurrent users

**Agentic:** Value delivered per resource consumed

| Traditional Metric | Agentic Equivalent         | Why It Matters             |
| ------------------ | -------------------------- | -------------------------- |
| Requests/sec       | **Goals completed/hour**   | Actual work done           |
| Concurrent users   | **Concurrent agent runs**  | Resource planning          |
| -                  | **Tokens per goal**        | Efficiency of reasoning    |
| -                  | **Tools per goal**         | Action efficiency          |
| Queue depth        | **Pending tool approvals** | Human bottleneck detection |

### 3. ERROR RATE

**Traditional:** Exceptions / Total Requests

**Agentic:** Multiple failure modes

```
Traditional errors:
- Exception thrown → easy to count

Agentic "errors":
- Exception thrown (traditional)
- Wrong answer (no exception, but wrong)
- Incomplete answer (partially right)
- Hallucination (confident but wrong)
- Goal not achieved (gave up)
- Guardrail triggered (blocked)
- Human rejected (override)
- Timeout (too slow)
```

| Traditional Metric | Agentic Equivalent         | Why It Matters           |
| ------------------ | -------------------------- | ------------------------ |
| Exception rate     | **Hard failure rate**      | Code/infra problems      |
| -                  | **Soft failure rate**      | Wrong/incomplete answers |
| -                  | **Hallucination rate**     | Ungrounded claims        |
| -                  | **Guardrail trigger rate** | Safety system engagement |
| -                  | **Human override rate**    | Trust calibration        |
| -                  | **Goal abandonment rate**  | User gave up on agent    |
| HTTP 4xx rate      | **Input rejection rate**   | Bad prompts/context      |
| HTTP 5xx rate      | **Model failure rate**     | Provider issues          |

### 4. AVAILABILITY / UPTIME

**Traditional:** Service available / Total time

**Agentic:** Capability availability

| Traditional Metric | Agentic Equivalent      | Why It Matters                |
| ------------------ | ----------------------- | ----------------------------- |
| Uptime %           | **Agent availability**  | Can agent accept requests?    |
| -                  | **Tool availability**   | Are all tools functional?     |
| -                  | **Model availability**  | Is the LLM responding?        |
| -                  | **Memory availability** | Can agent access history?     |
| Partial outage     | **Degraded capability** | Agent works but missing tools |

### 5. RESOURCE UTILIZATION

**Traditional:** CPU, Memory, Disk, Network

**Agentic:** Token economy + traditional resources

| Traditional Metric | Agentic Equivalent              | Why It Matters               |
| ------------------ | ------------------------------- | ---------------------------- |
| CPU usage          | Same + **Inference compute**    | Model serving load           |
| Memory usage       | Same + **Context window usage** | Are we wasting context?      |
| Network I/O        | **Token I/O**                   | Input vs output balance      |
| -                  | **Cache hit rate**              | Prompt caching effectiveness |
| -                  | **Cost per request**            | USD spent per interaction    |
| -                  | **Cost per goal**               | USD to achieve outcome       |
| Disk usage         | **Embedding storage**           | Vector DB growth             |

### 6. QUALITY METRICS

**Traditional:** Test pass rate, code coverage, bug count

**Agentic:** Output quality signals

| Traditional Metric | Agentic Equivalent       | Why It Matters             |
| ------------------ | ------------------------ | -------------------------- |
| Test pass rate     | **Eval pass rate**       | Scored evaluations         |
| Code coverage      | **Prompt coverage**      | Edge cases tested?         |
| Bug count          | **Bad response count**   | User-reported issues       |
| -                  | **Scorer distribution**  | Quality score histogram    |
| -                  | **User satisfaction**    | Thumbs up/down, ratings    |
| -                  | **Correction rate**      | How often user fixes agent |
| MTTR               | **Time to self-correct** | Agent catches own mistakes |

### 7. RELIABILITY METRICS

**Traditional:** MTBF, MTTR, Change failure rate

**Agentic:** Consistency and recovery

| Traditional Metric  | Agentic Equivalent             | Why It Matters                        |
| ------------------- | ------------------------------ | ------------------------------------- |
| MTBF                | **Steps between failures**     | How often agent messes up             |
| MTTR                | **Recovery step count**        | Steps to fix after error              |
| -                   | **Retry success rate**         | Do retries help?                      |
| -                   | **Fallback usage rate**        | How often backup model used           |
| Change failure rate | **Prompt change failure rate** | Did instruction changes break things? |

---

## New Metrics Unique to Agents

These have no traditional equivalent:

### Autonomy Metrics

```typescript
interface AutonomyMetrics {
  // How independently does the agent operate?
  autonomousActionsRatio: number; // actions without human input
  humanEscalationRate: number; // how often needs human help
  humanOverrideRate: number; // how often human changes decision
  approvalWaitTime: number; // time blocked on human
}
```

### Reasoning Efficiency

```typescript
interface ReasoningMetrics {
  // How efficiently does the agent think?
  stepsPerGoal: number; // fewer is better (usually)
  toolSelectionAccuracy: number; // right tool first try
  backtrackingRate: number; // had to undo/retry
  reasoningLoops: number; // circular thinking detected
  thinkingToActionRatio: number; // balance of reasoning vs doing
}
```

### Grounding & Trust

```typescript
interface GroundingMetrics {
  // Is the agent's output trustworthy?
  toolResultUtilization: number; // actually used retrieved data
  citationRate: number; // backed claims with sources
  ungroundedClaimRate: number; // made stuff up
  selfCorrectionRate: number; // caught own mistakes
}
```

### Memory Effectiveness

```typescript
interface MemoryMetrics {
  // Is memory helping or hurting?
  retrievalRelevance: number; // semantic search quality
  contextUtilization: number; // using available context
  workingMemoryAccuracy: number; // state tracking correctness
  conversationCoherence: number; // stays on topic
}
```

### Goal Achievement

```typescript
interface GoalMetrics {
  // Did the agent accomplish what was asked?
  goalCompletionRate: number; // fully achieved
  partialCompletionRate: number; // got part way
  goalAbandonmentRate: number; // gave up
  userSatisfactionScore: number; // explicit feedback
}
```

---

## The Observability Stack for Agents

```
┌─────────────────────────────────────────────────────────────────┐
│                         DASHBOARDS                               │
│  • Goal completion rate    • Cost per goal    • Quality scores  │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                          ANALYTICS                               │
│  • Trend analysis    • Anomaly detection    • Comparisons       │
└─────────────────────────────────────────────────────────────────┘
                              ▲
┌──────────────────┬──────────────────┬──────────────────────────┐
│     METRICS      │      LOGS        │        TRACES            │
│                  │                  │                          │
│ Counters:        │ Structured:      │ Spans:                   │
│ • runs_total     │ • agent.started  │ • AGENT_RUN              │
│ • errors_total   │ • tool.called    │ • MODEL_GENERATION       │
│ • tokens_total   │ • model.response │ • TOOL_CALL              │
│                  │ • guardrail.hit  │ • MEMORY_RETRIEVAL       │
│ Histograms:      │ • goal.completed │ • WORKFLOW_STEP          │
│ • duration_ms    │                  │                          │
│ • step_count     │ Context:         │ Attributes:              │
│ • cost_usd       │ • agentId        │ • input/output           │
│                  │ • runId          │ • token_usage            │
│ Gauges:          │ • traceId        │ • tool_results           │
│ • active_runs    │ • threadId       │ • finish_reason          │
│ • pending_approvals                 │ • error_details          │
└──────────────────┴──────────────────┴──────────────────────────┘
                              ▲
┌─────────────────────────────────────────────────────────────────┐
│                      INSTRUMENTATION                             │
│                                                                  │
│  Agent.stream() ──→ Loop ──→ LLM Call ──→ Tool Call ──→ Result  │
│       │              │          │            │            │      │
│       ▼              ▼          ▼            ▼            ▼      │
│   [start]        [step]     [model]      [tool]      [finish]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Priority

### Must Have (Day 1)

1. **Error tracking** - Exceptions, guardrail triggers, failures
2. **Latency** - TTFT, total duration, per-step timing
3. **Cost** - Tokens used, USD spent
4. **Basic quality** - Finish reason, scorer results

### Should Have (Week 1)

1. **Throughput** - Goals/hour, concurrent runs
2. **Resource utilization** - Context window, cache hits
3. **Human-in-the-loop** - Approval times, override rates
4. **Tool effectiveness** - Success rates, selection accuracy

### Nice to Have (Month 1)

1. **Reasoning analysis** - Step patterns, backtracking
2. **Memory effectiveness** - Retrieval relevance
3. **Autonomy tracking** - Independence metrics
4. **Comparative analysis** - A/B testing infrastructure

---

## Key Insight

> **In traditional software, failure is obvious (exceptions).
> In agentic software, failure is often invisible (wrong answers).**

This means:

1. You need **evaluators/scorers** running continuously, not just in tests
2. You need **human feedback** instrumented as a first-class metric
3. You need **outcome tracking** beyond the immediate response
4. You need **comparative baselines** to detect regression

The goal isn't just "is it up?" but "is it good?"
