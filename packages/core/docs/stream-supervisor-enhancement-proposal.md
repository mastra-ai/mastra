# Stream/Generate Supervisor Enhancement Proposal

> Comprehensive proposal for enhancing Mastra's `stream()`/`generate()` to become a complete supervisor implementation, potentially replacing `network()`

## Executive Summary

This document proposes enhancing Mastra's `stream()`/`generate()` method with features that would make it a **complete supervisor implementation**, bridging the gap with `network()` and potentially making `network()` redundant.

The key additions:

1. **Completion scoring** - External validators for task completion
2. **Iteration hooks** - Full control over continuation logic
3. **Conversation context for sub-agents** - Pass filtered message history
4. **Delegation hooks (with control)** - Observe, control, and bail from sub-agent invocations
5. **Bail/early termination** - Skip supervisor synthesis when sub-agent output suffices

After these changes, users would have **one unified API** for supervisor patterns, with `network()` being either deprecated or becoming an alias for stream.

---

## Part 1: Current State Analysis

### How stream/generate Works Today

**Entry Point:** [packages/core/src/agent/agent.ts](../../packages/core/src/agent/agent.ts)

**Agentic Loop:** [packages/core/src/loop/workflows/agentic-loop/index.ts](../../packages/core/src/loop/workflows/agentic-loop/index.ts)

The current flow:

```
User calls agent.stream(messages, options)
           │
           ▼
┌──────────────────────────────────────────┐
│         AGENTIC EXECUTION WORKFLOW        │
│                                           │
│  ┌─────────────────────────────────────┐ │
│  │     LLM Execution Step              │ │
│  │  - Process input processors         │ │
│  │  - Call LLM with tools              │ │
│  │  - Process output processors        │ │
│  └──────────────┬──────────────────────┘ │
│                 │                         │
│                 ▼                         │
│  ┌─────────────────────────────────────┐ │
│  │     Tool Call Step (if tools)       │ │
│  │  - Execute tool                     │ │
│  │  - Handle suspension/approval       │ │
│  │  - Return result to LLM             │ │
│  └──────────────┬──────────────────────┘ │
│                 │                         │
└─────────────────┼─────────────────────────┘
                  │
                  ▼
    dowhile loop continues if:
    - stepResult.isContinued === true
    - AND NOT stopWhen condition met
    - AND NOT maxSteps exceeded
```

### Current Stop Mechanisms

| Mechanism      | Type              | Description                                        |
| -------------- | ----------------- | -------------------------------------------------- |
| `maxSteps`     | number            | Hard limit on iterations (default: 5)              |
| `stopWhen`     | `StopCondition[]` | Sync/async predicates evaluated after each step    |
| `finishReason` | string            | LLM signals completion ('stop', 'error')           |
| `TripWire`     | exception         | Processor-triggered abort with optional retry      |

### What's Missing (Gap with Network)

| Feature                           | Network Has                | Stream Has         | Gap         |
| --------------------------------- | -------------------------- | ------------------ | ----------- |
| Completion scoring                | ✅                         | ❌                 | Critical    |
| Iteration hooks                   | ✅ `onIterationComplete`   | ❌                 | Critical    |
| Conversation context for sub-agents | ✅ Filtered history       | ❌ Only tool input | Important   |
| Delegation observability          | ✅ Events                  | ❌                 | Important   |
| Early termination (bail)          | ❌                         | ❌                 | Nice-to-have |

---

## Part 2: Proposed Enhancements

### Overview: Enhanced Stream Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ENHANCED AGENTIC LOOP                                │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                  LLM Execution Step                             │     │
│  │  - Input processors                                             │     │
│  │  - LLM call with tools (including sub-agent tools)             │     │
│  │  - Output processors                                            │     │
│  └─────────────────────────┬──────────────────────────────────────┘     │
│                            │                                             │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                  Tool Call Step                                 │     │
│  │  - NEW: onDelegationStart hook (can reject/modify)             │     │
│  │  - Execute tool (sub-agent gets filtered context if configured)│     │
│  │  - NEW: onDelegationComplete hook (with bail option)           │     │
│  └─────────────────────────┬──────────────────────────────────────┘     │
│                            │                                             │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │              NEW: Iteration Complete Hook                       │     │
│  │  - Call onIterationComplete with full context                  │     │
│  │  - Process result: { continue, feedback }                      │     │
│  │  - Add feedback to messages if provided                        │     │
│  └─────────────────────────┬──────────────────────────────────────┘     │
│                            │                                             │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │              NEW: Completion Scoring                            │     │
│  │  - Run scorers via runCompletionScorers                        │     │
│  │  - Apply strategy (all/any)                                    │     │
│  │  - Generate feedback if continueOnFail                         │     │
│  └─────────────────────────┬──────────────────────────────────────┘     │
│                            │                                             │
│                            ▼                                             │
│  ┌────────────────────────────────────────────────────────────────┐     │
│  │                  Existing: stopWhen Check                       │     │
│  └─────────────────────────┬──────────────────────────────────────┘     │
│                            │                                             │
│                            ▼                                             │
│                   Continue or Stop Decision                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Feature Specifications

### Feature 1: Completion Scoring

**Purpose:** External validators that determine if a task is truly complete.

**API:**

```typescript
interface StreamCompletionConfig {
  /** Scorers to evaluate after each iteration (return 0 or 1) */
  scorers: MastraScorer[]
  /** How to combine results: 'all' (default) or 'any' */
  strategy?: 'all' | 'any'
  /** Continue iterating on fail (default: false) */
  continueOnFail?: boolean
  /** Add scorer feedback as system message (default: true) */
  feedbackToLLM?: boolean
  /** Maximum time for scoring in ms (default: 30000) */
  timeout?: number
  /** Run scorers in parallel (default: true) */
  parallel?: boolean
  /** Called after scorers run */
  onComplete?: (results: StreamCompletionRunResult) => void | Promise<void>
}
```

**Usage:**

```typescript
const result = await supervisor.stream('Write a research paper', {
  completion: {
    scorers: [citationScorer, lengthScorer],
    strategy: 'all',
    continueOnFail: true,
    feedbackToLLM: true,
  },
})
```

**Implementation:** Reuse `runCompletionScorers()` and `formatCompletionFeedback()` from [packages/core/src/loop/network/validation.ts](../../packages/core/src/loop/network/validation.ts).

---

### Feature 2: Iteration Hooks

**Purpose:** Full control over continuation logic after each iteration.

**API:**

```typescript
interface IterationCompleteContext {
  iteration: number
  maxSteps?: number
  messages: MastraDBMessage[]
  originalTask: string
  currentStep: {
    text: string
    toolCalls: ToolCall[]
    toolResults: ToolResult[]
    finishReason: string
  }
  allSteps: StepResult[]
  subAgentsInvoked: string[]
  threadId?: string
  resourceId?: string
  runId: string
}

interface IterationCompleteResult {
  continue: boolean
  feedback?: string
}

onIterationComplete?: (context: IterationCompleteContext) => Promise<IterationCompleteResult> | IterationCompleteResult
```

**Usage:**

```typescript
const result = await supervisor.stream('Write a paper', {
  onIterationComplete: async ({ allSteps }) => {
    const text = allSteps.map(s => s.text).join('\n')
    const citations = (text.match(/\[\d+\]/g) || []).length

    if (citations >= 5) return { continue: false }
    return { continue: true, feedback: 'Need more citations' }
  },
})
```

---

### Feature 3: Conversation Context for Sub-agents

**Purpose:** Pass filtered message history to sub-agents, not just a prompt.

**API:**

```typescript
interface SubAgentContextConfig {
  /** Include conversation history (default: false) */
  includeConversationHistory?: boolean
  /** Filter internal messages (default: true) */
  filterInternalMessages?: boolean
  /** Maximum messages to include (default: 20) */
  maxMessages?: number
  /** Custom filter function */
  messageFilter?: (message: MastraDBMessage) => boolean
}

// Agent config
const supervisor = new Agent({
  agents: { researchAgent, writerAgent },
  subAgentContext: {
    includeConversationHistory: true,
    filterInternalMessages: true,
    maxMessages: 20,
  },
})
```

**Implementation:** Modify `listAgentTools()` to pass filtered messages. Reuse `filterMessagesForSubAgent()` from network.

---

### Feature 4: Delegation Hooks (with Control)

**Purpose:** Observe, control, and bail from sub-agent invocations.

**API:**

```typescript
interface DelegationStartContext {
  agentName: string
  prompt: string
  args: { prompt: string; threadId?: string; instructions?: string; maxSteps?: number }
  iterationContext: IterationCompleteContext
}

interface DelegationStartResult {
  proceed?: boolean
  modifiedPrompt?: string
  rejectionReason?: string
}

interface DelegationCompleteContext {
  agentName: string
  result: { text: string; subAgentThreadId?: string }
  duration: number
  iterationContext: IterationCompleteContext
  bail: () => void
}

onDelegationStart?: (context: DelegationStartContext) => Promise<DelegationStartResult | void>
onDelegationComplete?: (context: DelegationCompleteContext) => Promise<void>
```

**Usage - Observability:**

```typescript
const result = await supervisor.stream('Write a paper', {
  onDelegationStart: ({ agentName, prompt }) => {
    console.log(`→ ${agentName}: ${prompt.slice(0, 50)}...`)
  },
  onDelegationComplete: ({ agentName, duration }) => {
    console.log(`← ${agentName} (${duration}ms)`)
  },
})
```

**Usage - Control:**

```typescript
const result = await supervisor.stream('Write a paper', {
  onDelegationStart: async ({ agentName, prompt }) => {
    if (agentName === 'premiumAgent' && !user.isPremium) {
      return { proceed: false, rejectionReason: 'Premium required' }
    }
    return { proceed: true, modifiedPrompt: `${prompt}\n\nBe concise.` }
  },
  onDelegationComplete: async ({ agentName, result, bail }) => {
    if (result.text.includes('## Conclusion')) bail()
  },
})
```

---

### Feature 5: Bail/Early Termination

**Purpose:** Skip supervisor synthesis when sub-agent output is sufficient.

**Mechanism:** The `bail()` function sets a flag that:
1. Stops the agentic loop after tool execution
2. Returns sub-agent output as final result
3. Skips remaining LLM synthesis

**Token Savings:** VoltAgent reports up to 79% savings with bail.

---

### Feature 6: Enhanced Stream Events

**New Chunk Types:**

```typescript
type SupervisorChunkType =
  | { type: 'delegation-start'; payload: { agentName: string; prompt: string } }
  | { type: 'delegation-end'; payload: { agentName: string; duration: number } }
  | { type: 'delegation-bail'; payload: { agentName: string } }
  | { type: 'delegation-rejected'; payload: { agentName: string; reason: string } }
  | { type: 'iteration-start'; payload: { iteration: number } }
  | { type: 'iteration-end'; payload: { iteration: number; continue: boolean } }
  | { type: 'iteration-feedback'; payload: { message: string } }
  | { type: 'scoring-start'; payload: { scorerIds: string[] } }
  | { type: 'scorer-result'; payload: ScorerResult }
  | { type: 'scoring-complete'; payload: { complete: boolean; reason?: string } }
```

---

## Part 3.5: Implementation Details - Tool Execution & Delegation

### Regular Tools vs Sub-agent Tools

The LLM execution step can return multiple tool calls:

- **Regular tools** - User-defined tools (e.g., `searchWeb`, `calculateSum`)
- **Sub-agent tools** - Auto-generated from `agents` config (prefixed with `agent-`)

```
LLM Response → Tool Calls:
  [
    { name: 'searchWeb', args: {...} },       ← Regular tool
    { name: 'agent-researcher', args: {...} },← Sub-agent tool
    { name: 'calculateSum', args: {...} },    ← Regular tool
    { name: 'agent-writer', args: {...} },    ← Sub-agent tool
  ]
```

### Delegation Hooks Only Fire for Sub-agent Tools

```typescript
for (const toolCall of toolCalls) {
  if (toolCall.name.startsWith('agent-')) {
    // Sub-agent - fire delegation hooks
    const agentName = toolCall.name.replace('agent-', '')

    const startResult = await options.onDelegationStart?.({ agentName, prompt: toolCall.args.prompt })

    if (startResult?.proceed === false) {
      return { error: `Delegation rejected: ${startResult.rejectionReason}` }
    }

    const result = await subAgent.generate(startResult?.modifiedPrompt ?? toolCall.args.prompt)
    await options.onDelegationComplete?.({ agentName, result, bail })
  } else {
    // Regular tool - no hooks
    await executeTool(toolCall)
  }
}
```

### Concurrent Tool Execution

| Scenario                  | Behavior                                       |
| ------------------------- | ---------------------------------------------- |
| 2 regular tools           | Execute concurrently, no hooks                 |
| 1 regular + 1 sub-agent   | Both execute, hooks fire for sub-agent only    |
| 2 sub-agents (concurrent) | Both hook cycles run concurrently              |

### Bail Strategy with Concurrent Sub-agents

```typescript
interface StreamOptions {
  /** 'first': First bail() wins (default), 'last': Last wins */
  bailStrategy?: 'first' | 'last'
}
```

### Rejection Handling

When `onDelegationStart` returns `{ proceed: false }`:

```typescript
// Returned to LLM:
{ error: 'Delegation rejected: Premium feature required', rejected: true }
```

---

## Part 4: Unified API

### Complete Enhanced Stream Options

```typescript
interface EnhancedStreamOptions<OUTPUT = undefined> {
  // Existing
  maxSteps?: number
  stopWhen?: StopCondition | StopCondition[]
  memory?: MemoryConfig
  instructions?: string
  toolCallConcurrency?: number
  structuredOutput?: StructuredOutputOptions<OUTPUT>

  // NEW: Completion Scoring
  completion?: StreamCompletionConfig

  // NEW: Iteration Hooks
  onIterationComplete?: (context: IterationCompleteContext) => Promise<IterationCompleteResult>

  // NEW: Delegation Hooks
  onDelegationStart?: (context: DelegationStartContext) => Promise<DelegationStartResult | void>
  onDelegationComplete?: (context: DelegationCompleteContext) => Promise<void>

  // NEW: Bail Strategy
  bailStrategy?: 'first' | 'last'
}
```

### Complete Enhanced Agent Config

```typescript
interface EnhancedAgentConfig {
  // Existing
  id: string
  name: string
  instructions: string | DynamicArgument<string>
  model: MastraModelConfig
  agents?: DynamicArgument<Record<string, Agent>>
  workflows?: DynamicArgument<Record<string, Workflow>>
  tools?: DynamicArgument<ToolsInput>
  memory?: DynamicArgument<MastraMemory>

  // NEW: Sub-agent Context Config
  subAgentContext?: SubAgentContextConfig
}
```

---

## Part 5: Example - Complete Supervisor

```typescript
import { Agent, createScorer } from '@mastra/core'

const citationScorer = createScorer({
  id: 'citations',
  name: 'Citation Counter',
}).generateScore(async ({ output }) => {
  const citations = output.match(/\[\d+\]/g) || []
  return {
    score: new Set(citations).size >= 5 ? 1 : 0,
    reason: `Found ${new Set(citations).size}/5 required citations`,
  }
})

const paperSupervisor = new Agent({
  id: 'paper-supervisor',
  instructions: 'Write research papers. Delegate research and writing tasks.',
  model: 'openai/gpt-4',
  agents: { researchAgent, writerAgent },
  subAgentContext: {
    includeConversationHistory: true,
    filterInternalMessages: true,
    maxMessages: 15,
  },
})

const result = await paperSupervisor.stream('Write a paper about quantum computing', {
  maxSteps: 20,

  completion: {
    scorers: [citationScorer],
    strategy: 'all',
    continueOnFail: true,
  },

  onDelegationStart: async ({ agentName, prompt }) => {
    console.log(`→ ${agentName}`)
    return { proceed: true, modifiedPrompt: `${prompt}\n\nFocus on applications.` }
  },

  onDelegationComplete: async ({ agentName, result, duration, bail }) => {
    console.log(`← ${agentName} (${duration}ms)`)
    if (agentName === 'writerAgent' && result.text.includes('## References')) {
      bail()
    }
  },

  onIterationComplete: async ({ iteration, subAgentsInvoked }) => {
    console.log(`Iteration ${iteration}: ${subAgentsInvoked.join(', ')}`)
    return { continue: true }
  },
})

for await (const chunk of result.fullStream) {
  if (chunk.type === 'delegation-start') console.log(`Delegating to ${chunk.payload.agentName}`)
  if (chunk.type === 'delegation-bail') console.log(`Bailed with ${chunk.payload.agentName} output`)
  if (chunk.type === 'text-delta') process.stdout.write(chunk.payload.text)
}
```

---

## Part 6: Implementation Plan

### Phase 1: Core Hooks (Week 1-2)

| Task                              | File                         | Effort |
| --------------------------------- | ---------------------------- | ------ |
| Add `onIterationComplete` hook    | `agentic-loop/index.ts`      | Medium |
| Add `IterationCompleteContext`    | `loop/types.ts`              | Low    |
| Add feedback-to-messages logic    | `agentic-loop/index.ts`      | Low    |
| Unit tests                        | `agentic-loop/index.test.ts` | Medium |

### Phase 2: Completion Scoring (Week 2-3)

| Task                              | File                              | Effort |
| --------------------------------- | --------------------------------- | ------ |
| Add `completion` option           | `agent.types.ts`, `loop/types.ts` | Low    |
| Integrate `runCompletionScorers`  | `agentic-loop/index.ts`           | Medium |
| Add scoring stream events         | `stream/types.ts`                 | Low    |
| Unit tests                        | `agentic-loop/index.test.ts`      | Medium |

### Phase 3: Delegation Hooks + Bail (Week 3-4)

| Task                                 | File                      | Effort |
| ------------------------------------ | ------------------------- | ------ |
| Add `onDelegationStart` hook         | `agent.ts` (listAgentTools) | Medium |
| Add return value for reject/modify   | `agent.ts`                | Medium |
| Add `onDelegationComplete` with bail | `agent.ts`                | Medium |
| Add delegation stream events         | `stream/types.ts`         | Low    |
| Unit tests                           | `agent.test.ts`           | Medium |

### Phase 4: Sub-agent Context (Week 4-5)

| Task                              | File             | Effort |
| --------------------------------- | ---------------- | ------ |
| Add `subAgentContext` config      | `agent/types.ts` | Low    |
| Modify `listAgentTools`           | `agent.ts`       | Medium |
| Port `filterMessagesForSubAgent`  | `agent.ts`       | Low    |
| Integration tests                 | `agent.test.ts`  | Medium |

### Phase 5: Network Deprecation (Week 5+)

| Task                               | Effort |
| ---------------------------------- | ------ |
| Create migration guide             | Medium |
| Add deprecation warnings           | Low    |
| Evaluate adoption                  | -      |

---

## Part 7: Comparison - Before and After

### Network Features → Stream Equivalents

| Network Feature                 | Stream Equivalent (After Changes)            |
| ------------------------------- | -------------------------------------------- |
| `completion.scorers`            | `completion.scorers` ✅                      |
| `completion.strategy`           | `completion.strategy` ✅                     |
| `onIterationComplete`           | `onIterationComplete` ✅                     |
| Filtered context for sub-agents | `subAgentContext.includeConversationHistory` ✅ |
| `selectionReason` logging       | Via `onDelegationStart` hook ✅              |
| Delegation control              | `onDelegationStart` return value ✅          |
| Network stream events           | Supervisor stream events ✅                  |
| Required memory                 | Optional memory ✅ Better                    |
| Separate routing agent          | Implicit routing ✅ Simpler                  |

### Why Stream Becomes Superior

1. **Simpler mental model** - No separate routing agent
2. **Lower latency** - No extra LLM call for routing
3. **Optional memory** - Works without persistence
4. **Familiar tool pattern** - Sub-agents are just tools
5. **Full feature parity** - Everything network does
6. **Plus extras** - Bail mechanism, delegation control

---

## Part 8: Open Questions

| Question                                                   | Proposed Answer                                   |
| ---------------------------------------------------------- | ------------------------------------------------- |
| Should `onIterationComplete` run before or after scoring?  | Before - gives user first chance                  |
| Should bail bypass scoring?                                | Yes - user explicitly chose to stop               |
| Should we keep network() long-term?                        | Deprecate after adoption proves successful        |
| How to handle bail + streaming?                            | Emit `delegation-bail` event, close stream        |
| What if `onDelegationStart` rejects but LLM expects result?| Return tool error explaining rejection            |
| What happens to in-flight tools when bail is called?       | Let complete, discard results (first bail wins)   |
| Should regular tools trigger delegation hooks?             | No - hooks only for `agent-` prefixed tools       |

---

## Conclusion

After these enhancements, `stream()`/`generate()` becomes a **complete supervisor implementation** that:

1. ✅ Matches all network functionality
2. ✅ Adds features network doesn't have (bail, delegation control)
3. ✅ Maintains simpler mental model
4. ✅ Preserves backward compatibility
5. ✅ Reduces maintenance burden (one system instead of two)

**Recommendation:** Implement in phases, gather feedback, then deprecate `network()` in favor of enhanced `stream()`.
