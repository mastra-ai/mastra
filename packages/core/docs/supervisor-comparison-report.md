# Supervisor Pattern Comparison Report

> Comparing Mastra's stream/generate and network with other AI frameworks

**Created:** February 2026
**Purpose:** Identify gaps and opportunities for Mastra's supervisor implementation

---

## 1. Executive Summary

This report compares Mastra's supervisor patterns (`stream/generate` and `network`) with implementations in LangGraph, CrewAI, AutoGen, OpenAI Swarm, and VoltAgent.

**Key Finding:** Mastra's `stream/generate` is closest to VoltAgent/Swarm (tool-based delegation), while `network` is closer to LangGraph/CrewAI (explicit routing). Enhancing `stream/generate` with features from both approaches could create a unified, superior solution.

---

## 2. Routing Mechanism Comparison

### 2.1 How Each Framework Routes

| Framework | Routing Type | Mechanism | Extra LLM Call |
|-----------|--------------|-----------|----------------|
| **Mastra stream** | Implicit | LLM tool calls | No |
| **Mastra network** | Explicit | Routing agent | Yes |
| LangGraph | Explicit | Conditional edges | Yes |
| CrewAI | Hierarchical | Manager delegation | Yes |
| AutoGen | Conversational | Speaker selection | Varies |
| Swarm | Implicit | Function handoffs | No |
| VoltAgent | Implicit | LLM tool calls | No |

### 2.2 Analysis

**Implicit routing (stream, Swarm, VoltAgent):**
- Pros: Simpler, lower latency, no extra LLM call
- Cons: Less control, relies on LLM judgment

**Explicit routing (network, LangGraph, CrewAI):**
- Pros: More predictable, debugging via selection reasons
- Cons: Higher latency, more complex setup

---

## 3. Completion Validation Comparison

### 3.1 How Each Framework Validates Completion

| Framework | Validation Method | Multi-criteria | Feedback to LLM |
|-----------|------------------|----------------|-----------------|
| **Mastra stream** | `stopWhen` predicates | Limited | No |
| **Mastra network** | Scorer system | Yes | Yes |
| LangGraph | Conditional edges | Yes | Via state |
| CrewAI | Task completion | Yes | Via manager |
| AutoGen | Max rounds | No | Via conversation |
| Swarm | Agent decision | No | No |
| VoltAgent | Scorers + hooks | Yes | Yes |

### 3.2 Analysis

**Mastra stream's gap:** No built-in scorer support, no automatic feedback loop.

**Best practices from others:**
- VoltAgent's scorer system with configurable strategy (all/any)
- LangGraph's state-based conditions
- Network's feedback formatting for LLM

---

## 4. Sub-agent Context Comparison

### 4.1 What Context Sub-agents Receive

| Framework | Context Type | Filtering | History Limit |
|-----------|--------------|-----------|---------------|
| **Mastra stream** | Prompt only | N/A | N/A |
| **Mastra network** | Filtered messages | Yes | Configurable |
| LangGraph | State object | Custom | Custom |
| CrewAI | Task context | Automatic | Per-task |
| AutoGen | Full history | No | No |
| Swarm | Context variables | Manual | Manual |
| VoltAgent | Configurable | Optional | Configurable |

### 4.2 Analysis

**Mastra stream's gap:** Sub-agents only get the prompt, missing conversation context.

**Best practice:** Network's `filterMessagesForSubAgent()` provides the right balance of context without overwhelming sub-agents.

---

## 5. Early Termination Comparison

### 5.1 Bail/Skip Synthesis Capability

| Framework | Early Termination | Token Savings |
|-----------|-------------------|---------------|
| **Mastra stream** | No | N/A |
| **Mastra network** | No | N/A |
| LangGraph | Via END node | Medium |
| CrewAI | No | N/A |
| AutoGen | Via terminate | Low |
| Swarm | Via handoff | Medium |
| VoltAgent | `bail()` mechanism | Up to 79% |

### 5.2 Analysis

**Unique opportunity:** VoltAgent's bail mechanism reports significant token savings. Neither Mastra stream nor network currently supports this.

**Implementation:** `onDelegationComplete` hook with `bail()` function to skip supervisor synthesis.

---

## 6. Observability Comparison

### 6.1 Delegation Visibility

| Framework | Delegation Events | Hook Points | Debugging |
|-----------|------------------|-------------|-----------|
| **Mastra stream** | Via onStepFinish | After step | Limited |
| **Mastra network** | Stream events | Multiple | Good |
| LangGraph | Node events | Before/after | Excellent |
| CrewAI | Callbacks | Task-level | Good |
| AutoGen | Message events | Per-message | Good |
| Swarm | Manual | None | Poor |
| VoltAgent | Delegation hooks | Before/after | Excellent |

### 6.2 Analysis

**Mastra stream's gap:** No dedicated delegation hooks, must parse tool calls from onStepFinish.

**Best practice:** VoltAgent's `onDelegationStart`/`onDelegationComplete` provide clear visibility.

---

## 7. Feature Matrix

### 7.1 Comprehensive Comparison

| Feature | Mastra Stream | Mastra Network | LangGraph | CrewAI | AutoGen | Swarm | VoltAgent |
|---------|--------------|----------------|-----------|--------|---------|-------|-----------|
| Sub-agents as tools | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Explicit routing | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Completion scoring | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Iteration hooks | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Delegation hooks | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Bail mechanism | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Context for sub-agents | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Memory optional | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Streaming | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

### 7.2 Gap Analysis

**Mastra stream is missing:**
1. Completion scoring
2. Iteration hooks
3. Delegation hooks
4. Bail mechanism
5. Context for sub-agents

**Mastra network is missing:**
1. Delegation hooks
2. Bail mechanism
3. Optional memory

---

## 8. API Comparison

### 8.1 Supervisor Setup

**Mastra stream:**
```typescript
const supervisor = new Agent({
  id: 'supervisor',
  agents: { researcher, writer },
  tools: { searchWeb },
});

await supervisor.stream('Write a paper', { maxSteps: 20 });
```

**VoltAgent (similar pattern):**
```typescript
const supervisor = createAgent({
  name: 'supervisor',
  agents: [researcher, writer],
  onAgentComplete: ({ agent, result, bail }) => {
    if (result.includes('## Conclusion')) bail();
  },
});

await supervisor.chat('Write a paper');
```

**LangGraph (different pattern):**
```typescript
const graph = new StateGraph()
  .addNode('supervisor', supervisorNode)
  .addNode('researcher', researcherNode)
  .addConditionalEdges('supervisor', routeFunction);

await graph.invoke({ messages: ['Write a paper'] });
```

### 8.2 Completion Scoring

**Mastra network:**
```typescript
await agent.network('Write a paper', {
  completion: {
    scorers: [citationScorer, lengthScorer],
    strategy: 'all',
  },
});
```

**VoltAgent:**
```typescript
await supervisor.chat('Write a paper', {
  completion: {
    validators: [citationValidator],
    continueOnFail: true,
  },
});
```

---

## 9. Recommendations

### 9.1 Enhance Stream to Match Best Practices

| Feature to Add | Inspired By | Priority |
|----------------|-------------|----------|
| Completion scoring | Network, VoltAgent | High |
| Iteration hooks | Network, VoltAgent | High |
| Delegation hooks | VoltAgent | High |
| Bail mechanism | VoltAgent | Medium |
| Sub-agent context | Network | Medium |

### 9.2 Unified API Vision

Enhanced `stream/generate` could replace `network` by adding:

```typescript
await supervisor.stream('Write a paper', {
  // Existing
  maxSteps: 20,
  stopWhen: [...],

  // NEW: Completion scoring
  completion: {
    scorers: [citationScorer],
    strategy: 'all',
    continueOnFail: true,
  },

  // NEW: Iteration hooks
  onIterationComplete: async (ctx) => {
    return { continue: true, feedback: 'Need more citations' };
  },

  // NEW: Delegation hooks
  onDelegationStart: async ({ agentName, prompt }) => {
    return { proceed: true, modifiedPrompt: prompt };
  },
  onDelegationComplete: async ({ agentName, result, bail }) => {
    if (result.includes('## Conclusion')) bail();
  },
});
```

### 9.3 Migration Path

1. **Phase 1:** Add iteration hooks and completion scoring to stream
2. **Phase 2:** Add delegation hooks with bail mechanism
3. **Phase 3:** Add sub-agent context configuration
4. **Phase 4:** Deprecate network in favor of enhanced stream

---

## 10. Conclusion

Mastra's `stream/generate` has a solid foundation (tool-based delegation, streaming) but lacks advanced supervisor features found in other frameworks. By selectively adding features from network and VoltAgent, stream could become a comprehensive, unified supervisor implementation that:

- Matches all network functionality
- Adds features network doesn't have (bail, delegation hooks)
- Maintains simpler mental model than alternatives
- Provides best-in-class token efficiency

---

## 11. Related Documents

- [Supervisor Agent Research](supervisor-agent-research.md)
- [Agent Stream Architecture](agent-stream.md)
- [Agent Network Architecture](agent-network.md)
- [Stream Supervisor Enhancement Proposal](stream-supervisor-enhancement-proposal.md)
