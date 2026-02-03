# Agent Network vs Ralph Wiggum: Analysis & Bridging Proposal

## Side-by-Side Comparison

| Aspect                  | Agent Network                                  | Ralph Wiggum                              |
| ----------------------- | ---------------------------------------------- | ----------------------------------------- |
| **Purpose**             | Multi-agent orchestration with dynamic routing | Single agent autonomous iteration         |
| **Completion Check**    | LLM-based ("evaluate if task is complete")     | Programmatic (tests pass, build succeeds) |
| **Primitive Selection** | LLM decides (agent, workflow, or tool)         | Same agent handles everything             |
| **Context Strategy**    | Full conversation history in memory            | Sliding window of iteration results       |
| **Routing**             | Dynamic per-iteration                          | Fixed (single agent)                      |
| **Validation**          | Self-assessment                                | External verification                     |
| **Best For**            | Reasoning tasks, coordination                  | Mechanical tasks, verifiable outcomes     |

---

## Agent Network: How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      Agent Network Loop                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │   User Task  │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                          │
│   │  Routing Agent   │  ← "Which primitive should handle this?" │
│   │  (LLM Decision)  │                                          │
│   └──────┬───────────┘                                          │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────────────────────────────┐                  │
│   │              Branch                       │                  │
│   │  ┌─────────┐ ┌──────────┐ ┌──────────┐  │                  │
│   │  │  Agent  │ │ Workflow │ │   Tool   │  │                  │
│   │  └────┬────┘ └────┬─────┘ └────┬─────┘  │                  │
│   └───────┼───────────┼────────────┼────────┘                  │
│           └───────────┼────────────┘                            │
│                       ▼                                          │
│   ┌──────────────────────────────────────────┐                  │
│   │        Completion Evaluation              │                  │
│   │  LLM: "Is the task complete? Evaluate    │                  │
│   │  based on system instructions..."        │                  │
│   └──────────────────┬───────────────────────┘                  │
│                      │                                           │
│          ┌───────────┴───────────┐                              │
│          │                       │                               │
│      Complete?               Not Complete                        │
│          │                       │                               │
│          ▼                       └──────► Loop Back ─────────►  │
│   ┌──────────────┐                                              │
│   │ Final Result │                                              │
│   └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Code Points

**Completion Schema** (LLM evaluates):

```typescript
const completionSchema = z.object({
  isComplete: z.boolean(),
  finalResult: z.string(),
  completionReason: z.string(),
});
```

**Completion Prompt**:

```typescript
const completionPrompt = `
  The ${inputData.primitiveType} ${inputData.primitiveId} has contributed to the task.
  This is the result from the agent: ${inputData.result}
  
  You need to evaluate that our task is complete. Pay very close attention 
  to the SYSTEM INSTRUCTIONS for when the task is considered complete.
  Only return true if the task is complete according to the system instructions.
`;
```

**Loop Structure**:

```typescript
mainWorkflow
  .dountil(networkWorkflow, async ({ inputData }) => {
    return inputData.isComplete || (maxIterations && inputData.iteration >= maxIterations);
  })
  .then(finalStep)
  .commit();
```

---

## Ralph Wiggum: How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                      Ralph Wiggum Loop                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │  User Task   │ + Previous Iteration Context                 │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────────────────────────────┐                  │
│   │           Single Agent                    │                  │
│   │  (with tools for file editing, etc.)     │                  │
│   └──────────────────┬───────────────────────┘                  │
│                      │                                           │
│                      ▼                                           │
│   ┌──────────────────────────────────────────┐                  │
│   │       External Validation                 │  ← KEY DIFF     │
│   │  • Run tests: `npm test`                 │                  │
│   │  • Check build: `npm run build`          │                  │
│   │  • Lint check: `npm run lint`            │                  │
│   │  • Custom script                         │                  │
│   └──────────────────┬───────────────────────┘                  │
│                      │                                           │
│          ┌───────────┴───────────┐                              │
│          │                       │                               │
│      All Pass?               Failed                              │
│          │                       │                               │
│          ▼                       ▼                               │
│   ┌──────────────┐    ┌─────────────────────┐                   │
│   │   SUCCESS    │    │  Feed error to next │──► Loop Back ──►  │
│   │  (Task Done) │    │     iteration       │                   │
│   └──────────────┘    └─────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Characteristics

1. **No LLM Completion Check** - Validation is external/programmatic
2. **Failure Feedback** - Error output feeds into next iteration
3. **No Routing** - Same agent handles entire task
4. **Deterministic Validation** - Tests either pass or fail

---

## The Gap: Why Both Are Needed

### Agent Network Weakness

The Agent Network relies on **LLM self-assessment** for completion:

```typescript
// LLM decides if task is complete - can hallucinate!
completionResult = await completionStream.getFullOutput();
if (completionResult?.object?.isComplete) {
  return endPayload;
}
```

**Problem**: The LLM might think the task is complete when it isn't. There's no external validation that the changes actually work.

### Ralph Wiggum Weakness

Ralph Wiggum is **single-agent** only:

```bash
# Just one agent in a loop
while :; do cat PROMPT.md | claude ; done
```

**Problem**: Can't leverage specialized agents or workflows. No routing intelligence.

---

## Bridging Proposal: Unified Autonomous Loop

### Concept: Add External Validation to Agent Network

The key insight: **These patterns are complementary, not competing.**

- Agent Network provides: **routing, multi-primitive orchestration**
- Ralph Wiggum provides: **programmatic validation**

### Proposed API

```typescript
// Option 1: Add validation to networkLoop
const result = await agent.network(messages, {
  maxIterations: 50,

  // NEW: External validation before accepting LLM's "isComplete"
  validation: {
    // Run programmatic checks
    checks: [testsPassing('npm test'), buildSucceeds('npm run build'), lintClean('npm run lint')],

    // Strategy: 'all' = all checks must pass, 'any' = any check passes
    strategy: 'all',

    // Override LLM completion assessment
    // 'verify' = LLM says complete AND checks pass
    // 'override' = Only checks matter, ignore LLM assessment
    // 'llm-only' = Current behavior (default)
    mode: 'verify',
  },
});
```

### Option 2: Validation as a Primitive

Instead of adding validation options, make validation a first-class primitive that the routing agent can call:

```typescript
const agent = new Agent({
  id: 'code-migrator-network',
  instructions: `You orchestrate code migration tasks. 
    After making changes, ALWAYS call the validate tool to verify your work.`,
  agents: {
    codeWriter: codeWriterAgent,
    testWriter: testWriterAgent,
  },
  tools: {
    // NEW: Validation tools the network can use
    runTests: createTool({
      id: 'run-tests',
      description: 'Run the test suite to verify changes work',
      inputSchema: z.object({ testCommand: z.string().optional() }),
      execute: async ({ testCommand }) => {
        const result = await execAsync(testCommand || 'npm test');
        return {
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.stderr,
        };
      },
    }),
    runBuild: createTool({
      id: 'run-build',
      description: 'Build the project to verify no compilation errors',
      inputSchema: z.object({ buildCommand: z.string().optional() }),
      execute: async ({ buildCommand }) => {
        const result = await execAsync(buildCommand || 'npm run build');
        return {
          success: result.exitCode === 0,
          output: result.stdout,
        };
      },
    }),
  },
});
```

**Pros**:

- No API changes needed
- Routing agent learns when to validate
- More flexible - agent decides validation strategy

**Cons**:

- Agent might skip validation
- Less deterministic

### Option 3: Hybrid Completion Step

Modify the completion evaluation to include both LLM assessment AND programmatic validation:

```typescript
// In loop/network/index.ts - modify the completion step
const completionStep = createStep({
  id: 'completion-check',
  execute: async ({ inputData, getInitData }) => {
    const initData = await getInitData();
    const validationConfig = initData.validation;

    // Step 1: Run LLM completion assessment (existing behavior)
    const llmAssessment = await routingAgent.stream(completionPrompt, {
      structuredOutput: { schema: completionSchema },
    });
    const llmResult = await llmAssessment.getFullOutput();

    // Step 2: If validation configured, run programmatic checks
    if (validationConfig && llmResult?.object?.isComplete) {
      const validationResults = await Promise.all(validationConfig.checks.map(check => check()));

      const allPassed =
        validationConfig.strategy === 'all'
          ? validationResults.every(r => r.success)
          : validationResults.some(r => r.success);

      if (!allPassed) {
        // LLM thinks complete, but validation failed
        // Feed validation errors back into the loop
        return {
          isComplete: false,
          result: JSON.stringify({
            llmSaysComplete: true,
            validationFailed: true,
            errors: validationResults.filter(r => !r.success),
          }),
        };
      }
    }

    // Both LLM and validation agree: task is complete
    return {
      isComplete: llmResult?.object?.isComplete,
      result: llmResult?.object?.finalResult,
    };
  },
});
```

---

## Recommended Implementation

### Phase 1: Validation Tools (Low-Hanging Fruit)

Add built-in validation tools that any agent/network can use:

```typescript
// packages/core/src/tools/validation.ts
export const validationTools = {
  runCommand: createTool({
    id: 'run-command',
    description: 'Execute a shell command and return the result',
    inputSchema: z.object({
      command: z.string(),
      cwd: z.string().optional(),
      timeout: z.number().optional(),
    }),
    execute: async input => {
      const result = await execAsync(input.command, {
        cwd: input.cwd,
        timeout: input.timeout || 60000,
      });
      return {
        success: result.exitCode === 0,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    },
  }),

  runTests: createTool({
    id: 'run-tests',
    description: 'Run project tests and verify they pass',
    inputSchema: z.object({
      testCommand: z.string().default('npm test'),
    }),
    execute: async ({ testCommand }) => {
      // Implementation
    },
  }),

  verifyBuild: createTool({
    id: 'verify-build',
    description: 'Build the project and verify no errors',
    inputSchema: z.object({
      buildCommand: z.string().default('npm run build'),
    }),
    execute: async ({ buildCommand }) => {
      // Implementation
    },
  }),
};
```

### Phase 2: Validation Option for Network

Add a validation config to the network loop:

```typescript
// packages/core/src/loop/network/types.ts
export interface NetworkValidationConfig {
  checks: Array<() => Promise<{ success: boolean; message?: string }>>;
  strategy: 'all' | 'any';
  mode: 'verify' | 'override' | 'llm-only';
}

// Usage
await agent.network(messages, {
  validation: {
    checks: [testsPassing(), buildSucceeds()],
    strategy: 'all',
    mode: 'verify', // LLM must say complete AND checks must pass
  },
});
```

### Phase 3: Autonomous Loop API

Add a dedicated method that combines the best of both:

```typescript
// Combines Network routing + Ralph Wiggum validation
const result = await agent.autonomousNetwork({
  prompt: 'Migrate all tests from Jest to Vitest',

  // Use specialized agents for different aspects
  agents: {
    coder: codingAgent,
    tester: testingAgent,
  },

  // Programmatic completion validation
  completion: {
    check: async () => {
      const testResult = await runTests();
      const buildResult = await runBuild();
      return {
        success: testResult.passed && buildResult.success,
        message: testResult.passed ? 'All tests pass' : testResult.error,
      };
    },
  },

  // Safety limits
  maxIterations: 50,
  maxTokens: 500_000,

  // Progress tracking
  onIteration: ctx => {
    console.log(`Iteration ${ctx.iteration}: ${ctx.success ? '✅' : '❌'}`);
  },
});
```

---

## Summary: The Unified Vision

```
┌─────────────────────────────────────────────────────────────────┐
│              Unified Autonomous Loop                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │  User Task   │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────┐                                          │
│   │  Routing Agent   │  ← From Agent Network                    │
│   └──────┬───────────┘                                          │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────────────────────────────────┐                  │
│   │              Branch                       │                  │
│   │  ┌─────────┐ ┌──────────┐ ┌──────────┐  │                  │
│   │  │  Agent  │ │ Workflow │ │   Tool   │  │                  │
│   │  └─────────┘ └──────────┘ └──────────┘  │                  │
│   └──────────────────┬───────────────────────┘                  │
│                      │                                           │
│                      ▼                                           │
│   ┌──────────────────────────────────────────┐                  │
│   │       LLM Completion Assessment          │                  │
│   │       "Is the task complete?"            │                  │
│   └──────────────────┬───────────────────────┘                  │
│                      │                                           │
│          ┌───────────┴───────────┐                              │
│      LLM: No                 LLM: Yes                            │
│          │                       │                               │
│          │                       ▼                               │
│          │        ┌──────────────────────────┐                  │
│          │        │   External Validation    │ ← From Ralph     │
│          │        │   • Run tests            │     Wiggum       │
│          │        │   • Check build          │                  │
│          │        │   • Lint, etc.           │                  │
│          │        └───────────┬──────────────┘                  │
│          │                    │                                  │
│          │        ┌───────────┴───────────┐                     │
│          │    Validation              Validation                 │
│          │    Failed                  Passed                     │
│          │        │                       │                      │
│          ▼        ▼                       ▼                      │
│   ┌─────────────────────┐         ┌──────────────┐              │
│   │     Loop Back       │         │   SUCCESS    │              │
│   │ (with error context)│         │  (Task Done) │              │
│   └─────────────────────┘         └──────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**The unified approach:**

1. **Routes** tasks to the best primitive (from Agent Network)
2. **Validates** results programmatically (from Ralph Wiggum)
3. **Iterates** until both LLM and validation agree task is complete
4. **Learns** from validation failures to improve next iteration
