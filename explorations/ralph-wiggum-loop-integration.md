# Ralph Wiggum Loop Integration for Mastra

> **Status: IMPLEMENTED** - The Agent Network with validation IS the autonomous loop

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

## ✅ Implementation: Agent Network = Autonomous Loop

**There is no separate `autonomousLoop()` method.** The Agent Network with validation configuration IS the autonomous loop:

- **Agent Network** provides: routing, multi-primitive execution, iteration, memory
- **Validation config** adds: programmatic completion criteria, feedback loop

Together, this gives you the full Ralph Wiggum pattern without a separate API.

### Quick Start

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createCheck } from '@mastra/core/loop';

// Create validation checks with the flexible createCheck API
const testsCheck = createCheck({
  id: 'tests',
  name: 'Unit Tests',
  args: { command: 'npm test' },
  run: async (params) => {
    // params.args.command - your static config
    // params.iteration, params.messages - runtime context from network
    const { execSync } = await import('child_process');
    try {
      execSync(params.args.command, { stdio: 'pipe' });
      return { success: true, message: 'All tests passed' };
    } catch (e: any) {
      return { 
        success: false, 
        message: 'Tests failed',
        details: { stderr: e.stderr?.toString() }
      };
    }
  },
});

const agent = new Agent({
  id: 'code-migrator',
  instructions: 'You help migrate code between frameworks.',
  model: openai('gpt-4o'),
  memory: new Memory(),
  agents: {
    coder: codingAgent,
    tester: testingAgent,
  },
  // Set defaults for all network() calls
  defaultNetworkOptions: {
    maxSteps: 20,
    routing: {
      additionalInstructions: 'Prefer the coder agent for implementation tasks.',
    },
    completion: {
      additionalInstructions: 'Only mark complete when all requested changes are made.',
    },
  },
});

// Run network with programmatic validation
const result = await agent.network('Migrate all tests from Jest to Vitest', {
  maxSteps: 30,
  validation: {
    checks: [testsCheck],
    strategy: 'all',      // All checks must pass
    mode: 'verify',       // LLM says complete AND validation passes
    onValidation: (result) => {
      console.log(`Validation: ${result.passed ? '✅' : '❌'}`);
    },
  },
});

for await (const chunk of result.fullStream) {
  if (chunk.type === 'network-validation-end') {
    console.log(`Validation ${chunk.payload.passed ? 'passed' : 'failed'}`);
  }
}
```

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                 Agent Network + Validation                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Routing Agent selects primitive (agent/workflow/tool)      │
│                      ↓                                           │
│   2. Execute selected primitive                                  │
│                      ↓                                           │
│   3. Completion Assessment (LLM or custom)                      │
│                      ↓                                           │
│              ┌───────┴───────┐                                   │
│          Not Done        Done                                    │
│              │               │                                   │
│              │               ▼                                   │
│              │    4. Run Validation Checks                       │
│              │       (programmatic verification)                 │
│              │               │                                   │
│              │       ┌───────┴───────┐                          │
│              │   Validation      Validation                      │
│              │   Failed          Passed                          │
│              │       │               │                           │
│              │       ▼               ▼                           │
│              │   5. Inject      6. Complete!                     │
│              │   feedback          ✅                            │
│              │       │                                           │
│              └───────┴──────► Loop back to step 1               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Reference

### `createCheck(options)`

Creates a validation check from an async function. The `run` function receives a single object with both your static args and runtime context from the network.

```typescript
import { createCheck } from '@mastra/core/loop';

// With static args
const check = createCheck({
  id: 'unique-id',
  name: 'Human-readable name',
  args: { /* your config */ },
  run: async (params) => {
    // params.args - your static config
    // params.iteration - current iteration (1-based)
    // params.messages - conversation history
    // params.originalTask - the task prompt
    // params.selectedPrimitive - { id, type }
    // params.primitiveResult - result from last execution
    // params.llmSaysComplete - whether LLM marked as complete
    // params.networkName, params.runId, params.threadId, etc.
    
    return {
      success: boolean,
      message: string,
      details?: Record<string, unknown>,
    };
  },
});

// Without args (context only)
const simpleCheck = createCheck({
  id: 'simple',
  name: 'Simple Check',
  run: async (params) => {
    return { success: true, message: 'OK' };
  },
});
```

### `NetworkOptions`

Full configuration for `agent.network()`:

```typescript
interface NetworkOptions {
  // Execution limits
  maxSteps?: number;
  
  // Routing configuration
  routing?: {
    additionalInstructions?: string;
    verboseIntrospection?: boolean;
  };
  
  // Completion evaluation
  completion?: {
    // Custom evaluator (replaces LLM evaluation)
    evaluate?: (ctx: NetworkCompletionContext) => Promise<NetworkCompletionResult>;
    // Additional instructions for LLM evaluation
    additionalInstructions?: string;
    // Skip LLM evaluation (rely on validation only)
    skipLLMEvaluation?: boolean;
  };
  
  // Programmatic validation
  validation?: {
    checks: ValidationCheck[];
    strategy?: 'all' | 'any';
    mode?: 'verify' | 'override' | 'assist';
    timeout?: number;
    parallel?: boolean;
    onValidation?: (result: ValidationRunResult) => void;
  };
  
  // Callbacks
  onIterationComplete?: (ctx: IterationContext) => void;
  
  // Memory & context
  memory?: AgentMemoryOption;
  requestContext?: RequestContext;
  runId?: string;
}
```

### `defaultNetworkOptions` on Agent

Set defaults that apply to all `network()` calls:

```typescript
const agent = new Agent({
  // ...
  defaultNetworkOptions: {
    maxSteps: 20,
    routing: { additionalInstructions: '...' },
    completion: { additionalInstructions: '...' },
    validation: { checks: [...], mode: 'verify' },
  },
});

// These defaults are merged with call-specific options
await agent.network('task', { maxSteps: 30 }); // maxSteps overridden, others inherited
```

---

## Validation Modes

| Mode | Behavior |
|------|----------|
| `verify` (default) | Task complete when LLM says done AND validation passes |
| `override` | Only validation matters, LLM completion is ignored |
| `assist` | Validation provides context to LLM but doesn't block completion |

---

## Stream Events

```typescript
for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'network-validation-start':
      console.log(`Running ${chunk.payload.checksCount} checks...`);
      break;
    case 'network-validation-end':
      console.log(`Validation: ${chunk.payload.passed ? '✅' : '❌'}`);
      break;
    case 'routing-agent-start':
      console.log(`Iteration ${chunk.payload.inputData.iteration}`);
      break;
  }
}
```
