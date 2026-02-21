# Agent Network Architecture

> Mastra's routing-based supervisor pattern via `agent.network()`

**Created:** February 2026
**Source:** [packages/core/src/loop/network/index.ts](../../packages/core/src/loop/network/index.ts)

---

## 1. Overview

`agent.network()` implements a **routing-based supervisor pattern** where a dedicated routing agent explicitly decides which sub-agent or workflow to execute next.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| Routing | Explicit - dedicated routing agent makes decisions |
| Sub-agent invocation | Via routing decision schema |
| Memory | Required for conversation persistence |
| Completion validation | Built-in scorer support |

---

## 2. Architecture

### 2.1 Two-Level Supervisor

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NETWORK ORCHESTRATION                        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    ROUTING AGENT (Level 1)                    │   │
│  │                                                               │   │
│  │  "Given the conversation and available primitives,            │   │
│  │   decide which agent/workflow/tool to execute next"           │   │
│  │                                                               │   │
│  │  Output: RoutingDecision {                                    │   │
│  │    primitiveId: "researcher",                                 │   │
│  │    primitiveType: "agent",                                    │   │
│  │    prompt: "Research quantum computing",                      │   │
│  │    selectionReason: "Need research before writing"            │   │
│  │  }                                                            │   │
│  └──────────────────────────┬────────────────────────────────────┘   │
│                             │                                         │
│                             ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               SUB-AGENT EXECUTION (Level 2)                   │   │
│  │                                                               │   │
│  │  Execute selected primitive with:                             │   │
│  │  - Filtered conversation context                              │   │
│  │  - Prompt from routing decision                               │   │
│  │  - Own tools and capabilities                                 │   │
│  └──────────────────────────┬────────────────────────────────────┘   │
│                             │                                         │
│                             ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  COMPLETION VALIDATION                        │   │
│  │                                                               │   │
│  │  Run scorers to determine if task is complete                 │   │
│  │  - All scorers pass → STOP                                    │   │
│  │  - Any scorer fails → Add feedback, CONTINUE                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Routing Decision Schema

```typescript
// packages/core/src/loop/network/index.ts
const routingDecisionSchema = z.object({
  primitiveId: z.string().describe('The ID of the selected primitive'),
  primitiveType: z.enum(['agent', 'workflow', 'tool']),
  prompt: z.string().describe('The prompt to send to the primitive'),
  selectionReason: z.string().describe('Why this primitive was selected'),
});
```

---

## 3. Execution Flow

### 3.1 Main Loop

```typescript
// Simplified from packages/core/src/loop/network/index.ts
async function networkLoop(config: NetworkConfig) {
  while (iteration < maxIterations) {
    // 1. Routing agent decides next action
    const decision = await routingAgent.generate(messages, {
      structuredOutput: { schema: routingDecisionSchema }
    });

    // 2. Execute selected primitive
    if (decision.primitiveType === 'agent') {
      const subAgent = config.agents[decision.primitiveId];
      const filteredMessages = filterMessagesForSubAgent(messages);
      result = await subAgent.generate(filteredMessages);
    }

    // 3. Run completion scorers
    const scorerResults = await runCompletionScorers(config.completion);

    if (allScorersPass(scorerResults)) {
      break; // Task complete
    }

    // 4. Add feedback and continue
    messages.push(formatCompletionFeedback(scorerResults));
    iteration++;
  }
}
```

### 3.2 Message Filtering for Sub-agents

```typescript
// packages/core/src/loop/network/index.ts:75-109
function filterMessagesForSubAgent(messages: Message[]): Message[] {
  return messages.filter(msg => {
    // Remove internal network messages
    if (msg.metadata?.isNetworkInternal) return false;
    // Remove routing decisions
    if (msg.metadata?.isRoutingDecision) return false;
    // Keep user and assistant messages
    return true;
  }).slice(-maxMessages); // Limit history length
}
```

---

## 4. Configuration

### 4.1 Network Options

```typescript
interface NetworkOptions {
  // Primitives available for routing
  agents?: Record<string, Agent>;
  workflows?: Record<string, Workflow>;
  tools?: Record<string, Tool>;

  // Completion validation
  completion?: {
    scorers: MastraScorer[];
    strategy: 'all' | 'any';
  };

  // Iteration control
  maxIterations?: number;
  onIterationComplete?: (context: IterationContext) => Promise<IterationResult>;

  // Memory (required)
  memory: MemoryConfig;
}
```

### 4.2 Completion Scoring

```typescript
// packages/core/src/loop/network/validation.ts
interface CompletionConfig {
  scorers: MastraScorer[];
  strategy: 'all' | 'any';
  continueOnFail?: boolean;
  feedbackToLLM?: boolean;
}

async function runCompletionScorers(config: CompletionConfig): Promise<ScorerResults> {
  const results = await Promise.all(
    config.scorers.map(scorer => scorer.score(context))
  );

  const passed = config.strategy === 'all'
    ? results.every(r => r.score === 1)
    : results.some(r => r.score === 1);

  return { passed, results };
}
```

---

## 5. Key Features

### 5.1 Explicit Routing Decisions

The routing agent produces structured decisions with:
- **primitiveId**: Which agent/workflow/tool to invoke
- **primitiveType**: Type of primitive
- **prompt**: What to send to the primitive
- **selectionReason**: Why this was chosen (for debugging)

### 5.2 Filtered Context for Sub-agents

Sub-agents receive filtered conversation history:
- Internal network messages removed
- Routing decisions filtered out
- History limited to prevent context overflow

### 5.3 Completion Validation

External scorers validate task completion:
- Run after each iteration
- Strategy: all must pass or any can pass
- Feedback added to LLM if failed

### 5.4 Iteration Hooks

Control loop continuation:
```typescript
onIterationComplete: async (context) => {
  if (context.subAgentInvoked === 'writer') {
    return { continue: false }; // Stop after writer
  }
  return { continue: true, feedback: 'Keep going' };
}
```

---

## 6. Comparison with Stream

| Aspect | Network | Stream |
|--------|---------|--------|
| Routing | Explicit (routing agent) | Implicit (LLM tool calls) |
| Extra LLM call | Yes (for routing) | No |
| Memory | Required | Optional |
| Sub-agent context | Filtered history | Just prompt |
| Completion scoring | Built-in | Not available |
| Complexity | Higher | Lower |

---

## 7. When to Use Network

**Use network when:**
- Need explicit routing decisions with reasons
- Require completion validation via scorers
- Want filtered context passed to sub-agents
- Need iteration hooks for control

**Use stream instead when:**
- Simple delegation is sufficient
- Don't need explicit routing reasons
- Want lower latency (no routing LLM call)
- Memory is optional

---

## 8. Related Files

- [packages/core/src/loop/network/index.ts](../../packages/core/src/loop/network/index.ts) - Main implementation
- [packages/core/src/loop/network/validation.ts](../../packages/core/src/loop/network/validation.ts) - Completion scoring
- [packages/core/src/agent/agent.ts](../../packages/core/src/agent/agent.ts) - Agent.network() method
