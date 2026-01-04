# Ralph Wiggum Loop Integration Analysis for Mastra

## What is the Ralph Wiggum Loop?

The Ralph Wiggum loop (named after The Simpsons character) is an autonomous agent execution pattern where an AI agent works persistently and iteratively until completion criteria are met. The core philosophy is: **"Let the agent fail repeatedly until it succeeds."**

### Core Concept

```bash
# The essence of Ralph Wiggum in bash:
while :; do cat PROMPT.md | claude ; done
```

### Key Characteristics

1. **Persistent Iteration**: The agent loops continuously, re-attempting the task with each iteration
2. **Context Preservation**: Each iteration sees the modified files, git history, and results from previous runs
3. **Completion Criteria**: Clear, programmatic success metrics (tests pass, build succeeds, etc.)
4. **Safety Controls**: Max iterations, cost limits, circuit breakers
5. **Failure as Data**: Each failed attempt informs the next iteration

### When It Works Best

- **Large refactors**: Framework migrations, dependency upgrades
- **Batch operations**: Test coverage, documentation generation, code standardization
- **Greenfield builds**: Overnight project scaffolding with iterative refinement
- **Tasks with clear success metrics**: "All tests pass", "Build succeeds", "Lint clean"

### When NOT to Use

- Ambiguous requirements (can't define "done" precisely)
- Architectural decisions requiring human reasoning
- Security-sensitive code needing human review
- Exploratory tasks requiring human curiosity

---

## Mastra's Existing Primitives

### 1. Workflow Loops (`doWhile` / `doUntil`)

Mastra workflows already have loop constructs:

```typescript
// packages/core/src/workflows/workflow.ts
workflow
  .dowhile(step, async ({ inputData }) => {
    // Continue while condition is true
    return inputData.shouldContinue;
  })
  .dountil(step, async ({ inputData }) => {
    // Continue until condition is true  
    return inputData.isComplete;
  })
```

**Strengths**: 
- Step-level iteration with condition checking
- Full workflow state management
- Suspend/resume capability

**Gap**: No built-in support for iteration history or external validation

### 2. Agent `stopWhen` Condition

Agents support multi-step execution with stop conditions:

```typescript
// packages/core/src/loop/types.ts
export type LoopOptions = {
  stopWhen?: StopCondition | Array<StopCondition>;
  maxSteps?: number;
  // ...
};

// Usage
const stream = await agent.stream('Task description', {
  stopWhen: ({ steps }) => {
    // Check accumulated steps for completion
    return steps.some(step => step.toolCalls.includes('success'));
  },
});
```

**Strengths**:
- Per-step evaluation
- Access to accumulated step results
- Multiple conditions support

**Gap**: Focused on stopping within a single execution, not across multiple autonomous iterations

### 3. Agent Network Loop

Multi-agent coordination with routing and completion checking:

```typescript
// packages/core/src/loop/network/index.ts
// Creates a routing agent that orchestrates multiple agents
// Includes completion evaluation with schema validation
const completionSchema = z.object({
  isComplete: z.boolean(),
  finalResult: z.string(),
  completionReason: z.string(),
});
```

**Strengths**:
- Multi-agent orchestration
- LLM-based completion evaluation
- Memory integration

**Gap**: Doesn't support external validation or programmatic success criteria

---

## Integration Proposals

### Option 1: `agent.autonomousLoop()` Method

Add a new execution method to Agent that implements the Ralph Wiggum pattern:

```typescript
interface AutonomousLoopConfig {
  // Core prompt/task
  prompt: string;
  
  // Completion criteria - the key differentiator
  completion: {
    // Programmatic check (tests, build, lint, etc.)
    check: () => Promise<{ success: boolean; message?: string }>;
    // Or LLM-based evaluation
    evaluatePrompt?: string;
    // Or string matching (like original Ralph Wiggum)
    outputContains?: string;
  };
  
  // Safety controls
  maxIterations: number;
  maxCost?: number; // Token/dollar limit
  
  // Iteration config
  iterationDelay?: number;
  onIteration?: (result: IterationResult) => void;
  
  // Context preservation
  preserveHistory?: boolean;
  checkpointEvery?: number; // Git commit every N iterations
}

interface IterationResult {
  iteration: number;
  success: boolean;
  error?: Error;
  output: string;
  tokensUsed: number;
  duration: number;
}

// Usage
const result = await agent.autonomousLoop({
  prompt: 'Migrate all tests from Jest to Vitest',
  completion: {
    check: async () => {
      const result = await execAsync('npm test');
      return { 
        success: result.exitCode === 0,
        message: result.output 
      };
    },
  },
  maxIterations: 50,
  onIteration: (result) => {
    console.log(`Iteration ${result.iteration}: ${result.success ? '✅' : '❌'}`);
  },
});
```

**Pros**:
- Clean, focused API
- Natural fit with agent semantics
- Easy to understand

**Cons**:
- New method on Agent class
- Separate from workflow system

### Option 2: Workflow `autonomousUntil` Primitive

Add a new workflow construct for autonomous agent loops:

```typescript
import { createWorkflow, createStep, autonomousUntil } from '@mastra/core/workflows';

const migrationWorkflow = createWorkflow({
  id: 'jest-to-vitest-migration',
  inputSchema: z.object({
    targetPath: z.string(),
  }),
})
  .autonomousUntil(
    createStep(migratorAgent),
    {
      // Completion condition
      until: async ({ stepResult, context }) => {
        const testResult = await runTests(context.inputData.targetPath);
        return testResult.success;
      },
      
      // Safety limits
      maxIterations: 50,
      
      // Optional: modify prompt between iterations
      prepareIteration: async ({ iteration, previousResults }) => ({
        prompt: `Previous attempts: ${previousResults.length}. Last error: ${previousResults.at(-1)?.error}`,
      }),
      
      // Optional: checkpoint to git
      checkpoint: async ({ iteration, stepResult }) => {
        if (iteration % 5 === 0) {
          await execAsync('git add -A && git commit -m "Checkpoint iteration ' + iteration + '"');
        }
      },
    }
  )
  .commit();
```

**Pros**:
- Integrates with workflow system
- Leverages existing persistence and resume capabilities
- Can compose with other workflow steps

**Cons**:
- More complex API
- Requires workflow infrastructure

### Option 3: `AutonomousAgent` Wrapper Class

Create a specialized wrapper that adds autonomous capabilities:

```typescript
import { AutonomousAgent } from '@mastra/core/autonomous';

const autonomousAgent = new AutonomousAgent({
  agent: baseAgent,
  
  // How to check if task is complete
  completionChecker: {
    type: 'programmatic',
    check: async (context) => {
      return (await runTests()).passed;
    },
  },
  
  // Safety controls
  limits: {
    maxIterations: 50,
    maxTokens: 1_000_000,
    maxDuration: '4h',
  },
  
  // Iteration behavior
  behavior: {
    // Feed previous context to agent
    contextStrategy: 'cumulative', // or 'last-n' or 'summarize'
    contextSize: 10, // Keep last 10 iterations
    
    // Error handling
    onError: 'retry', // or 'fail' or 'pause'
    maxConsecutiveErrors: 3,
  },
  
  // Observability
  hooks: {
    onIterationStart: (ctx) => console.log(`Starting iteration ${ctx.iteration}`),
    onIterationComplete: (ctx) => saveCheckpoint(ctx),
    onComplete: (ctx) => sendNotification(ctx),
  },
});

// Execute
const result = await autonomousAgent.run({
  prompt: 'Add comprehensive tests for all uncovered functions in src/',
});
```

**Pros**:
- Doesn't modify existing Agent class
- Highly configurable
- Clear separation of concerns

**Cons**:
- Another abstraction layer
- May feel disconnected from core Agent

### Option 4: Composition with Existing Primitives

Use existing Mastra primitives to implement the pattern:

```typescript
import { createWorkflow, createStep } from '@mastra/core/workflows';
import { Agent } from '@mastra/core/agent';

const agentStep = createStep(myAgent);

const checkCompletionStep = createStep({
  id: 'check-completion',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ 
    isComplete: z.boolean(),
    text: z.string(),
    iteration: z.number(),
  }),
  execute: async ({ inputData, state, setState }) => {
    const iteration = (state.iteration ?? 0) + 1;
    setState({ iteration });
    
    // Run programmatic check
    const testResult = await runTests();
    
    return {
      isComplete: testResult.passed,
      text: inputData.text,
      iteration,
    };
  },
});

// Compose into autonomous loop
const autonomousWorkflow = createWorkflow({
  id: 'autonomous-loop',
  inputSchema: z.object({ prompt: z.string() }),
  stateSchema: z.object({ iteration: z.number() }),
})
  .then(agentStep)
  .dountil(checkCompletionStep, async ({ inputData }) => {
    return inputData.isComplete || inputData.iteration >= 50;
  })
  .commit();
```

**Pros**:
- Uses existing primitives
- No new APIs needed
- Flexible composition

**Cons**:
- Verbose for common patterns
- Less ergonomic

---

## Recommended Approach

**Primary Recommendation: Option 1 + Option 4**

1. **Implement `agent.autonomousLoop()`** as a high-level API for common use cases
2. **Document the composition pattern** (Option 4) for advanced customization

This provides:
- Simple API for 80% use case
- Full flexibility via workflow composition
- Minimal new surface area
- Builds on existing primitives

### Implementation Roadmap

#### Phase 1: Core Loop Primitive
```typescript
// Add to packages/core/src/agent/agent.ts
async autonomousLoop(config: AutonomousLoopConfig): Promise<AutonomousLoopResult> {
  // Implementation using internal workflow
}
```

#### Phase 2: Completion Checkers
```typescript
// packages/core/src/autonomous/checkers/
export const testsPassing = (testCommand: string) => createChecker(...);
export const buildSucceeds = (buildCommand: string) => createChecker(...);
export const lintClean = (lintCommand: string) => createChecker(...);
export const outputContains = (pattern: string | RegExp) => createChecker(...);
export const llmEvaluates = (prompt: string, model: Model) => createChecker(...);
```

#### Phase 3: Progress & Observability
- Iteration tracking
- Cost monitoring  
- Progress streaming
- Checkpoint/resume support

---

## Key Design Decisions

### 1. Context Preservation Strategy

How should iteration context be passed to subsequent iterations?

**Options**:
- **Full history**: Pass all previous outputs (can grow large)
- **Summary**: LLM-summarize previous iterations
- **Sliding window**: Keep last N iterations
- **Structured state**: Extract key facts/progress markers

**Recommendation**: Default to sliding window (last 5 iterations) with option for full history or custom summarization.

### 2. Failure Handling

What happens when an iteration fails?

**Options**:
- **Immediate retry**: Try again immediately
- **Backoff retry**: Exponential backoff
- **Pause for review**: Stop and await human input
- **Circuit breaker**: Stop after N consecutive failures

**Recommendation**: Default to backoff retry with circuit breaker at 5 consecutive failures.

### 3. Progress Communication

How should progress be communicated?

**Options**:
- **Streaming events**: Real-time iteration events
- **Callbacks**: Hook functions
- **Pub/sub**: Workflow-style events

**Recommendation**: Support all three - streaming for real-time UIs, callbacks for simple cases, pub/sub for distributed scenarios.

### 4. Cost Control

How to prevent runaway costs?

**Options**:
- **Token limits**: Max tokens per iteration and total
- **Cost limits**: Dollar amount limits
- **Time limits**: Max duration
- **Iteration limits**: Max iterations (always required)

**Recommendation**: Require iteration limit, support optional token/cost/time limits.

---

## Conclusion

The Ralph Wiggum loop pattern maps well to Mastra's existing primitives. The recommended approach is to add an `agent.autonomousLoop()` method that provides an ergonomic API for autonomous iteration while leveraging Mastra's workflow infrastructure for execution, persistence, and observability.

Key differentiators from the original Ralph Wiggum:
- **Programmatic completion checking**: Not just string matching
- **Rich observability**: Full tracing and metrics
- **Composability**: Can be used within larger workflows
- **Type safety**: Full TypeScript support
