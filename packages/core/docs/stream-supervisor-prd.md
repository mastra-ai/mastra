# PRD: Stream/Generate Supervisor Enhancement

> Product Requirements Document for enhancing Mastra's `stream()`/`generate()` to become a complete supervisor implementation

**Author:** Engineering
**Status:** Draft
**Created:** February 2026
**Last Updated:** February 2026

---

## 1. Overview

### 1.1 Problem Statement

Mastra currently offers two approaches for multi-agent orchestration:

1. **`stream()`/`generate()`** - Tool-based supervisor pattern (simpler, implicit routing)
2. **`network()`** - Routing-based supervisor pattern (complex, explicit routing)

This creates cognitive overhead for users who must learn two systems. Additionally, `stream()` lacks several capabilities that `network()` provides:

- No programmatic completion validation
- No conversation context passed to sub-agents
- No delegation observability hooks
- No way to short-circuit when a sub-agent produces the final answer

### 1.2 Proposed Solution

Enhance `stream()`/`generate()` with features that make it a **complete supervisor implementation**, capable of handling all use cases currently requiring `network()`. This allows users to:

1. Use one unified API for all supervisor patterns
2. Validate task completion with external scorers
3. Pass filtered conversation history to sub-agents
4. Observe and control delegation to sub-agents
5. Skip supervisor synthesis when sub-agent output suffices (bail)

### 1.3 Goals

| Goal                            | Success Metric                                     |
| ------------------------------- | -------------------------------------------------- |
| Unify supervisor patterns       | Users can accomplish network() tasks with stream() |
| Reduce cognitive overhead       | One API to learn instead of two                    |
| Maintain backward compatibility | Existing stream() code works unchanged             |
| Improve developer experience    | Clear documentation, intuitive API                 |
| Enable cost optimization        | Bail mechanism reduces token usage                 |

### 1.4 Non-Goals

- Breaking backward compatibility with existing stream behavior
- Forcing users to migrate from network() immediately
- Adding mandatory configuration for simple use cases

---

## 2. User Stories

### 2.1 Core User Stories

**US-1: Research Paper Supervisor**

> As a developer building a research paper generator, I want the supervisor to keep iterating until the paper has at least 5 citations, so that I get quality output without manual checking.

**US-2: Code Review Pipeline**

> As a developer building a code review agent, I want to validate that all lint errors are fixed before the task completes, so that reviews are thorough.

**US-3: Multi-Agent Coordination**

> As a developer coordinating multiple specialized agents, I want sub-agents to have access to conversation history so they understand the full context of the task.

**US-4: Token Cost Optimization**

> As a developer, I want to skip the supervisor's final synthesis when a sub-agent produces the complete answer, so that I reduce token usage and latency.

**US-5: Debugging Delegation**

> As a developer, I want to see when my supervisor delegates to sub-agents, so that I can debug and optimize agent behavior.

**US-6: Multi-Criteria Validation**

> As a developer, I want to specify multiple completion criteria (length + quality + format), so that tasks only complete when all requirements are met.

### 2.2 Secondary User Stories

**US-7: Custom Iteration Control**

> As a developer, I want to provide custom feedback to the LLM when validation fails, so that the agent understands what's missing.

**US-8: Graceful Degradation**

> As a developer, I want the agent to stop after a maximum number of iterations even if validation never passes, so that my system doesn't run forever.

**US-9: Observability Integration**

> As a developer, I want delegation events in my observability pipeline, so that I can track agent behavior in production.

---

## 3. Feature Requirements

### 3.1 Feature Overview

| #   | Feature                             | Priority    | Complexity |
| --- | ----------------------------------- | ----------- | ---------- |
| 1   | Iteration Hooks                     | Must Have   | Medium     |
| 2   | Completion Scoring                  | Must Have   | Medium     |
| 3   | Delegation Hooks (with control)     | Must Have   | Medium     |
| 4   | Bail/Early Termination              | Should Have | Low        |
| 5   | Conversation Context for Sub-agents | Should Have | Medium     |
| 6   | Enhanced Stream Events              | Should Have | Low        |

---

### 3.2 Feature 1: Iteration Hooks

**Purpose:** Give developers full control over whether to continue iterating after each step.

**User Value:**

- Custom validation logic without framework constraints
- Dynamic feedback to guide the LLM
- Integration with external systems for validation

**Requirements:**

| ID    | Requirement                                                       | Priority    |
| ----- | ----------------------------------------------------------------- | ----------- |
| F1-R1 | Add `onIterationComplete` callback option                         | Must Have   |
| F1-R2 | Callback receives full iteration context (messages, steps, tools) | Must Have   |
| F1-R3 | Callback returns `{ continue: boolean, feedback?: string }`       | Must Have   |
| F1-R4 | Feedback is added as system message to LLM                        | Must Have   |
| F1-R5 | Callback is async-compatible                                      | Must Have   |
| F1-R6 | Callback timeout defaults to 30s, configurable                    | Should Have |
| F1-R7 | Callback errors are logged but don't crash stream                 | Should Have |

**API:**

```typescript
onIterationComplete?: (context: IterationCompleteContext) => Promise<IterationCompleteResult>

interface IterationCompleteContext {
  iteration: number
  maxSteps?: number
  messages: MastraDBMessage[]
  originalTask: string
  currentStep: { text: string; toolCalls: ToolCall[]; toolResults: ToolResult[] }
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
```

---

### 3.3 Feature 2: Completion Scoring

**Purpose:** Validate task completion using external scorers (MastraScorer).

**User Value:**

- Reusable validation logic via scorers
- Multi-criteria validation with strategies (all/any)
- Automatic feedback generation to LLM

**Requirements:**

| ID    | Requirement                                        | Priority    |
| ----- | -------------------------------------------------- | ----------- |
| F2-R1 | Add `completion` config option                     | Must Have   |
| F2-R2 | Accept array of `MastraScorer` instances           | Must Have   |
| F2-R3 | Support `strategy: 'all' \| 'any'` (default: 'all') | Must Have   |
| F2-R4 | Support `continueOnFail` option (default: false)   | Should Have |
| F2-R5 | Support `feedbackToLLM` option (default: true)     | Should Have |
| F2-R6 | Emit scoring stream events                         | Should Have |
| F2-R7 | Reuse `runCompletionScorers` from network          | Must Have   |

**API:**

```typescript
completion?: {
  scorers: MastraScorer[]
  strategy?: 'all' | 'any'
  continueOnFail?: boolean
  feedbackToLLM?: boolean
  timeout?: number
  onComplete?: (results: CompletionRunResult) => void
}
```

---

### 3.4 Feature 3: Delegation Hooks (with Control)

**Purpose:** Observe and control when the supervisor delegates to sub-agents.

**User Value:**

- Visibility into delegation decisions
- Logging and metrics for sub-agent usage
- Ability to reject or modify delegations before they happen
- Ability to short-circuit via bail mechanism after completion

**Requirements:**

| ID    | Requirement                                                        | Priority    |
| ----- | ------------------------------------------------------------------ | ----------- |
| F3-R1 | Add `onDelegationStart` callback                                   | Must Have   |
| F3-R2 | Add `onDelegationComplete` callback                                | Must Have   |
| F3-R3 | Callbacks receive agent name, prompt, and context                  | Must Have   |
| F3-R4 | `onDelegationStart` can return to reject or modify the delegation  | Should Have |
| F3-R5 | `onDelegationComplete` receives duration and result                | Must Have   |
| F3-R6 | `onDelegationComplete` receives `bail()` function                  | Must Have   |
| F3-R7 | Callbacks are async-compatible                                     | Must Have   |

**API:**

```typescript
onDelegationStart?: (context: DelegationStartContext) => Promise<DelegationStartResult | void>
onDelegationComplete?: (context: DelegationCompleteContext) => Promise<void>

interface DelegationStartContext {
  agentName: string
  prompt: string
  args: { prompt: string; threadId?: string; instructions?: string }
}

interface DelegationStartResult {
  proceed?: boolean
  modifiedPrompt?: string
  rejectionReason?: string
}

interface DelegationCompleteContext {
  agentName: string
  result: { text: string }
  duration: number
  bail: () => void
}
```

---

### 3.5 Feature 4: Bail/Early Termination

**Purpose:** Skip supervisor synthesis when a sub-agent produces the final answer.

**User Value:**

- Significant token savings (up to 79% reported by VoltAgent)
- Reduced latency for delegated tasks
- Direct passthrough of sub-agent expertise

**Requirements:**

| ID    | Requirement                                       | Priority    |
| ----- | ------------------------------------------------- | ----------- |
| F4-R1 | `bail()` function stops loop after tool execution | Must Have   |
| F4-R2 | Sub-agent output becomes final result             | Must Have   |
| F4-R3 | `delegation-bail` stream event emitted            | Should Have |
| F4-R4 | Bail bypasses completion scoring                  | Must Have   |
| F4-R5 | When multiple sub-agents call bail, first wins    | Must Have   |
| F4-R6 | Support `bailStrategy` option ('first' or 'last') | Should Have |

---

### 3.6 Feature 5: Conversation Context for Sub-agents

**Purpose:** Pass filtered conversation history to sub-agents instead of just a prompt.

**User Value:**

- Sub-agents understand the full task context
- Better coordination in multi-step workflows
- Matches network() behavior for migration

**Requirements:**

| ID    | Requirement                                          | Priority    |
| ----- | ---------------------------------------------------- | ----------- |
| F5-R1 | Add `subAgentContext` config to Agent                | Must Have   |
| F5-R2 | `includeConversationHistory` option (default: false) | Must Have   |
| F5-R3 | `filterInternalMessages` option (default: true)      | Should Have |
| F5-R4 | `maxMessages` limit option (default: 20)             | Should Have |
| F5-R5 | Reuse `filterMessagesForSubAgent` from network       | Must Have   |

**API:**

```typescript
subAgentContext?: {
  includeConversationHistory?: boolean
  filterInternalMessages?: boolean
  maxMessages?: number
  messageFilter?: (message: MastraDBMessage) => boolean
}
```

---

### 3.7 Feature 6: Enhanced Stream Events

**Purpose:** Rich observability for supervisor operations.

**Requirements:**

| ID    | Requirement                                       | Priority    |
| ----- | ------------------------------------------------- | ----------- |
| F6-R1 | Emit `delegation-start` / `delegation-end` events | Must Have   |
| F6-R2 | Emit `delegation-bail` event                      | Should Have |
| F6-R3 | Emit `delegation-rejected` event                  | Should Have |
| F6-R4 | Emit `iteration-start` / `iteration-end` events   | Should Have |
| F6-R5 | Emit `scoring-start` / `scoring-complete` events  | Should Have |
| F6-R6 | Events include timing and context information     | Must Have   |

---

### 3.8 Implementation Detail: Regular Tools vs Sub-agent Tools

**Context:** The LLM can return multiple tool calls in a single response, including both regular tools and sub-agent tools.

**Tool Identification:** Sub-agent tools are identified by their `agent-` prefix.

```typescript
{ name: 'searchWeb', args: {...} }        // Regular tool - NO hooks
{ name: 'agent-researcher', args: {...} } // Sub-agent - hooks fire
```

**Requirements:**

| ID     | Requirement                                                   | Priority  |
| ------ | ------------------------------------------------------------- | --------- |
| F3-R8  | Delegation hooks only fire for tools with `agent-` prefix     | Must Have |
| F3-R9  | Regular tools execute without any delegation hook overhead    | Must Have |
| F3-R10 | Rejected delegations return tool error to LLM                 | Must Have |
| F3-R11 | Multiple concurrent sub-agents each get their own hook calls  | Must Have |

---

## 4. Execution Order & Precedence

```
After LLM Response:
1. onIterationComplete hook → { continue: false } → STOP
2. onIterationComplete hook → { continue: true, feedback } → ADD FEEDBACK
3. completion.scorers → all pass → STOP (success)
4. completion.scorers → fail + !continueOnFail → STOP (fail)
5. completion.scorers → fail + continueOnFail → ADD FEEDBACK, CONTINUE
6. stopWhen predicate → true → STOP (safety)
7. maxSteps exceeded → STOP (limit)
8. finishReason === 'stop' → STOP (LLM done)
9. Otherwise → CONTINUE
```

---

## 5. User Experience

### 5.1 Example: Simple Iteration Hook

```typescript
const result = await supervisor.stream('Write a paper', {
  maxSteps: 20,
  onIterationComplete: async ({ allSteps }) => {
    const text = allSteps.map(s => s.text).join('\n')
    const citations = (text.match(/\[\d+\]/g) || []).length
    if (citations >= 5) return { continue: false }
    return { continue: true, feedback: `Need ${5 - citations} more citations.` }
  },
})
```

### 5.2 Example: Completion Scoring

```typescript
const result = await supervisor.stream('Write a report', {
  completion: {
    scorers: [lengthScorer, structureScorer, citationScorer],
    strategy: 'all',
    continueOnFail: true,
  },
})
```

### 5.3 Example: Delegation with Bail

```typescript
const result = await supervisor.stream('Analyze this data', {
  onDelegationComplete: async ({ agentName, result, bail }) => {
    if (agentName === 'dataAnalyst' && result.text.includes('## Conclusion')) {
      bail()
    }
  },
})
```

### 5.4 Example: Delegation Control

```typescript
const result = await supervisor.stream('Process request', {
  onDelegationStart: async ({ agentName, prompt }) => {
    if (agentName === 'premiumAgent' && !user.isPremium) {
      return { proceed: false, rejectionReason: 'Premium required' }
    }
    return { proceed: true, modifiedPrompt: `${prompt}\n\nBe concise.` }
  },
})
```

### 5.5 Example: Full Supervisor Configuration

```typescript
const supervisor = new Agent({
  id: 'paper-supervisor',
  instructions: 'Coordinate research and writing.',
  agents: { researchAgent, writerAgent },
  subAgentContext: {
    includeConversationHistory: true,
    filterInternalMessages: true,
    maxMessages: 15,
  },
})

const result = await supervisor.stream('Write a paper about AI', {
  maxSteps: 20,
  completion: { scorers: [citationScorer], strategy: 'all', continueOnFail: true },
  onDelegationStart: ({ agentName }) => console.log(`→ ${agentName}`),
  onDelegationComplete: ({ agentName, duration, bail }) => {
    console.log(`← ${agentName} (${duration}ms)`)
    if (agentName === 'writerAgent') bail()
  },
})
```

---

## 6. Implementation Phases

### Phase 1: Core Hooks (Week 1-2)

| Deliverable                               | Owner     |
| ----------------------------------------- | --------- |
| `onIterationComplete` hook implementation | Core team |
| TypeScript types for hook context         | Core team |
| Unit tests for iteration hooks            | Core team |
| Documentation                             | Core team |

### Phase 2: Completion Scoring (Week 2-3)

| Deliverable                             | Owner     |
| --------------------------------------- | --------- |
| `completion` config implementation      | Core team |
| Integration with `runCompletionScorers` | Core team |
| Scoring stream events                   | Core team |
| Unit and integration tests              | Core team |

### Phase 3: Delegation Hooks + Bail (Week 3-4)

| Deliverable                                  | Owner     |
| -------------------------------------------- | --------- |
| `onDelegationStart` / `onDelegationComplete` | Core team |
| Return value support for reject/modify       | Core team |
| Bail mechanism implementation                | Core team |
| Delegation stream events                     | Core team |
| Tests                                        | Core team |

### Phase 4: Sub-agent Context (Week 4-5)

| Deliverable                      | Owner     |
| -------------------------------- | --------- |
| `subAgentContext` config         | Core team |
| Message filtering for sub-agents | Core team |
| Integration tests                | Core team |

### Phase 5: Network Deprecation (Week 5+)

| Deliverable                            | Owner        |
| -------------------------------------- | ------------ |
| Migration guide from network to stream | Docs team    |
| Deprecation warnings in network()      | Core team    |
| User feedback collection               | Product team |

---

## 7. Testing Requirements

### 7.1 Unit Tests

| Test Case                                              | Priority  |
| ------------------------------------------------------ | --------- |
| onIterationComplete called with correct context        | Must Have |
| onIterationComplete continue: false stops loop         | Must Have |
| Feedback added as system message                       | Must Have |
| Scorers run in correct order                           | Must Have |
| Scorers all/any strategy works                         | Must Have |
| Bail stops loop and returns sub-agent output           | Must Have |
| Delegation hooks receive correct context               | Must Have |
| onDelegationStart can reject delegation                | Must Have |
| onDelegationStart can modify prompt                    | Must Have |
| Sub-agent context filtering works                      | Must Have |
| Delegation hooks only fire for `agent-` prefixed tools | Must Have |
| Regular tools execute without delegation hooks         | Must Have |
| Concurrent sub-agents each get own hook calls          | Must Have |
| First bail wins when multiple sub-agents call bail     | Must Have |
| Rejected delegation returns error to LLM               | Must Have |

### 7.2 Integration Tests

| Test Case                                            | Priority    |
| ---------------------------------------------------- | ----------- |
| End-to-end supervisor with sub-agents + scoring      | Must Have   |
| Memory integration with new features                 | Must Have   |
| Stream events emitted correctly                      | Should Have |
| Bail + streaming works correctly                     | Should Have |
| Delegation rejection works end-to-end                | Should Have |
| Mixed regular + sub-agent tools in same response     | Must Have   |
| Concurrent sub-agents with bail                      | Should Have |
| Regular tools unaffected by delegation hooks         | Must Have   |

### 7.3 Performance Tests

| Test Case                       | Target             |
| ------------------------------- | ------------------ |
| Hook overhead (no-op)           | < 10ms             |
| Scorer overhead (no-op)         | < 50ms             |
| 10 iterations with all features | < 5s excluding LLM |

---

## 8. Documentation Requirements

| Document                        | Content                           |
| ------------------------------- | --------------------------------- |
| API Reference                   | Complete docs for all new options |
| Guide: Supervisor Patterns      | When to use each feature          |
| Guide: Completion Scoring       | Writing and using scorers         |
| Guide: Migration from network() | Step-by-step migration            |
| Examples                        | 5+ examples covering all features |

---

## 9. Risks and Mitigations

| Risk                              | Likelihood | Impact | Mitigation                              |
| --------------------------------- | ---------- | ------ | --------------------------------------- |
| Breaking existing stream behavior | Low        | High   | Extensive backward-compat tests         |
| Performance regression            | Medium     | Medium | Performance benchmarks in CI            |
| User confusion with two systems   | Medium     | Medium | Clear migration guide, deprecation path |
| Feature creep                     | Medium     | Low    | Strict scope, phased rollout            |

---

## 10. Open Questions

| Question                                                | Proposed Answer                                 |
| ------------------------------------------------------- | ----------------------------------------------- |
| Should onIterationComplete run before or after scoring? | Before - gives user first chance                |
| Should bail bypass scoring?                             | Yes - user explicitly chose to stop             |
| Should we deprecate network() immediately?              | No - deprecate after adoption proves successful |
| How to handle hook errors?                              | Log and continue by default                     |
| Should scoring results persist to memory?               | Optional, off by default                        |
| What happens to in-flight tools when bail is called?    | Let them complete, discard results (first wins) |
| Should regular tools trigger delegation hooks?          | No - hooks only fire for `agent-` prefixed tools |
| How to handle concurrent hook errors?                   | Log error, continue with other tools            |

---

## 11. Appendix

### 11.1 Feature Mapping: Network → Stream

| Network Feature                 | Stream Equivalent                            |
| ------------------------------- | -------------------------------------------- |
| `completion.scorers`            | `completion.scorers`                         |
| `completion.strategy`           | `completion.strategy`                        |
| `onIterationComplete`           | `onIterationComplete`                        |
| Filtered context for sub-agents | `subAgentContext.includeConversationHistory` |
| `selectionReason` logging       | Via `onDelegationStart` hook                 |
| Network stream events           | Supervisor stream events                     |
| Required memory                 | Optional memory                              |
| Separate routing agent          | Implicit routing (simpler)                   |

### 11.2 Why Enhanced Stream is Superior

1. **Simpler mental model** - No separate routing agent concept
2. **Lower latency** - No extra LLM call for routing decisions
3. **Optional memory** - Works without persistence
4. **Familiar tool pattern** - Sub-agents are just tools
5. **Full feature parity** - Everything network does, stream can do
6. **Plus extras** - Bail mechanism, delegation control hooks

### 11.3 Glossary

| Term            | Definition                                                  |
| --------------- | ----------------------------------------------------------- |
| Iteration       | One LLM call + tool execution cycle                         |
| Scorer          | MastraScorer that returns 0 (fail) or 1 (pass)              |
| Hook            | Callback function called at specific points                 |
| Bail            | Skip supervisor synthesis, return sub-agent output directly |
| Delegation      | Invoking a sub-agent tool                                   |
| Sub-agent tool  | Auto-generated tool from `agents` config (prefixed `agent-`) |
| Regular tool    | User-defined tool (no `agent-` prefix)                      |
| Bail strategy   | How to handle multiple concurrent bail() calls              |

### 11.4 Related Documents

- [Stream Supervisor Enhancement Proposal](stream-supervisor-enhancement-proposal.md)
- [Agent Stream Architecture](agent-stream.md)
- [Agent Network Architecture](agent-network.md)
- [Supervisor Comparison Report](supervisor-comparison-report.md)
