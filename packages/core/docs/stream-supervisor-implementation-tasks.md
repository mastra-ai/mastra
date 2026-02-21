# Stream Supervisor Enhancement: Implementation Tasks

> Implementation checklist for enhancing `stream()`/`generate()` to become a feature-complete supervisor

**Created:** February 2026
**Source:** [Enhanced Stream Competitive Analysis](./enhanced-stream-competitive-analysis.md)
**PRD:** [Stream Supervisor PRD](./stream-supervisor-prd.md)
**Technical Spec:** [Stream Supervisor Enhancement Proposal](./stream-supervisor-enhancement-proposal.md)

---

## Overview

This document tracks the implementation tasks required to enhance Mastra's `stream()`/`generate()` method with supervisor capabilities that would make it:
- **Superior to VoltAgent** (closest competitor)
- **Competitive with LangGraph, CrewAI, AutoGen, and Swarm**

### Unique Features to Implement

After these enhancements, Mastra would be the **only framework** offering ALL of:
1. Tool-based implicit routing (simple)
2. External completion scoring (robust)
3. Delegation control hooks with reject/modify (flexible)
4. Bail mechanism with configurable strategy (efficient)
5. Optional memory (convenient)
6. Full streaming support (real-time)

---

## Implementation Tasks

### 1. Completion Scoring System

Enable external validation of task completion using `MastraScorer`.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Implement completion scoring system with MastraScorer support | ✅ Done | Core scoring infrastructure implemented in agentic-loop |
| 1.2 | Add completion strategy configuration ('all'/'any') for multi-criteria validation | ✅ Done | Strategy configuration in CompletionConfig |
| 1.3 | Implement automatic feedback loop to LLM when scoring fails | ✅ Done | Feedback formatted and added as assistant message |

**API Target:**
```typescript
completion: {
  scorers: [citationScorer, lengthScorer],
  strategy: 'all', // or 'any'
  continueOnFail: true,
}
```

---

### 2. Iteration Hooks

Allow inspection and control after each agentic loop iteration.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Add onIterationComplete hook with continue/feedback return value | ✅ Done | Hook implemented and tested in agentic-loop |

**API Target:**
```typescript
onIterationComplete: async (context) => {
  // context: { iteration, messages, lastStepResult, toolResults }
  return {
    continue: true,
    feedback: 'Need more detail on section 2'
  };
}
```

---

### 3. Delegation Hooks

Enable observation and control of sub-agent delegations.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Implement onDelegationStart hook for sub-agent tool calls | ✅ Done | Implemented in listAgentTools |
| 3.2 | Add delegation rejection capability (proceed: false, rejectionReason) | ✅ Done | Returns rejection message to LLM |
| 3.3 | Add delegation modification capability (modifiedPrompt) | ✅ Done | Supports modifiedPrompt, modifiedInstructions, modifiedMaxSteps |
| 3.4 | Implement onDelegationComplete hook with bail() function | ✅ Done | Implemented with bail marker on result |
| 3.5 | Add bailStrategy configuration ('first'/'last') for concurrent execution | ✅ Done | Configured in DelegationConfig |

**API Target:**
```typescript
onDelegationStart: async ({ agentName, prompt, toolCallId }) => {
  return {
    proceed: true,           // or false to reject
    modifiedPrompt: prompt,  // optional transformation
    rejectionReason: '',     // if proceed: false
  };
},

onDelegationComplete: async ({ agentName, result, bail }) => {
  if (result.includes('## Conclusion')) {
    bail(); // Skip supervisor synthesis
  }
},

bailStrategy: 'first', // or 'last'
```

---

### 4. Context & Concurrency

Improve sub-agent context and ensure proper concurrent execution.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Implement sub-agent context configuration for message filtering | ✅ Done | Implemented in listAgentTools with maxMessages, includeSystem, includeToolMessages, and custom filter |
| 4.2 | Ensure tool concurrency works correctly with delegation hooks | ✅ Done | Delegation hooks work correctly with concurrent tool execution |

**API Target:**
```typescript
// Sub-agent context filtering (in agent config)
agents: {
  researcher: {
    agent: researchAgent,
    context: {
      includeHistory: true,
      maxMessages: 10,
      filterRoles: ['user', 'assistant'],
    }
  }
}
```

---

### 5. Type Definitions

Define TypeScript types for all new options and contexts.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Add StreamCompletionConfig type definition | ✅ Done | CompletionConfig defined in loop/network/validation.ts |
| 5.2 | Add DelegationStartContext and DelegationCompleteContext types | ✅ Done | Defined in agent.types.ts |
| 5.3 | Add IterationCompleteContext and IterationCompleteResult types | ✅ Done | Defined in agent.types.ts |
| 5.4 | Update EnhancedStreamOptions interface with all new options | ✅ Done | All options integrated in AgentExecutionOptionsBase |

**Type Targets:**
```typescript
interface StreamCompletionConfig {
  scorers: MastraScorer[];
  strategy?: 'all' | 'any';
  continueOnFail?: boolean;
}

interface DelegationStartContext {
  agentName: string;
  prompt: string;
  toolCallId: string;
  messages: CoreMessage[];
}

interface DelegationStartResult {
  proceed?: boolean;
  modifiedPrompt?: string;
  rejectionReason?: string;
}

interface DelegationCompleteContext {
  agentName: string;
  result: string;
  toolCallId: string;
  bail: () => void;
}

interface IterationCompleteContext {
  iteration: number;
  messages: CoreMessage[];
  lastStepResult: StepResult;
  toolResults: ToolResult[];
}

interface IterationCompleteResult {
  continue: boolean;
  feedback?: string;
}

interface EnhancedStreamOptions<OUTPUT = undefined> {
  maxSteps?: number;
  stopWhen?: StopCondition | StopCondition[];
  completion?: StreamCompletionConfig;
  onIterationComplete?: (ctx: IterationCompleteContext) => Promise<IterationCompleteResult>;
  onDelegationStart?: (ctx: DelegationStartContext) => Promise<DelegationStartResult | void>;
  onDelegationComplete?: (ctx: DelegationCompleteContext) => Promise<void>;
  bailStrategy?: 'first' | 'last';
}
```

---

### 6. Core Implementation

Modify existing code to support new features.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Modify listAgentTools() to integrate delegation hooks | ✅ Done | Delegation hooks and context filtering integrated |
| 6.2 | Update agentic loop to support iteration hooks and completion scoring | ✅ Done | Both features implemented in agentic-loop workflow |

**Key Files:**
- `packages/core/src/agent/agent.ts` - listAgentTools() modification
- `packages/core/src/loop/workflows/agentic-loop/index.ts` - Loop modifications

---

### 7. Testing

Comprehensive test coverage for all new features.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | Write unit tests for completion scoring system | ✅ Done | Tests exist in loop/network |
| 7.2 | Write unit tests for delegation hooks (start/complete/reject/modify) | ✅ Done | delegation-hooks.test.ts |
| 7.3 | Write unit tests for bail mechanism and bail strategy | ✅ Done | Covered in delegation-hooks.test.ts |
| 7.4 | Write integration tests for supervisor pattern with sub-agents | ✅ Done | supervisor-integration.test.ts, iteration-complete-hook.test.ts, context-filter.test.ts |

---

### 8. Documentation

Update user-facing documentation.

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | Update documentation with new stream() options and examples | ⬜ Pending | API docs and usage examples |

---

## Progress Summary

| Category | Total | Completed | Remaining |
|----------|-------|-----------|-----------|
| Completion Scoring | 3 | 3 | 0 |
| Iteration Hooks | 1 | 1 | 0 |
| Delegation Hooks | 5 | 5 | 0 |
| Context & Concurrency | 2 | 2 | 0 |
| Type Definitions | 4 | 4 | 0 |
| Core Implementation | 2 | 2 | 0 |
| Testing | 4 | 4 | 0 |
| Documentation | 1 | 0 | 1 |
| **Total** | **22** | **21** | **1** |

---

## Implementation Phases

### Phase 1: Foundation (Tasks 5.1-5.4, 1.1-1.3)
- Define all type definitions
- Implement completion scoring system

### Phase 2: Iteration Control (Tasks 2.1, 6.2)
- Add iteration hooks
- Update agentic loop

### Phase 3: Delegation Control (Tasks 3.1-3.5, 6.1)
- Implement delegation hooks
- Modify listAgentTools()

### Phase 4: Context & Polish (Tasks 4.1-4.2)
- Add sub-agent context configuration
- Ensure concurrency works correctly

### Phase 5: Testing & Documentation (Tasks 7.1-7.4, 8.1)
- Write comprehensive tests
- Update documentation

---

## Related Documents

- [Enhanced Stream Competitive Analysis](./enhanced-stream-competitive-analysis.md)
- [Stream Supervisor PRD](./stream-supervisor-prd.md)
- [Stream Supervisor Enhancement Proposal](./stream-supervisor-enhancement-proposal.md)
- [Supervisor Comparison Report](./supervisor-comparison-report.md)
- [Agent Stream Architecture](./agent-stream.md)
- [Supervisor Agent Research](./supervisor-agent-research.md)
