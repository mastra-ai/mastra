# Ralph Wiggum Loop Integration for Mastra

> **Status: IMPLEMENTED** - The Agent Network with completion checks IS the autonomous loop

## What is the Ralph Wiggum Loop?

The Ralph Wiggum loop is an autonomous agent execution pattern where an AI agent works persistently and iteratively until completion criteria are met. The core philosophy: **"Let the agent fail repeatedly until it succeeds."**

### Key Characteristics

1. **Persistent Iteration**: The agent loops continuously
2. **Context Preservation**: Each iteration sees results from previous runs
3. **Completion Criteria**: Clear success metrics (tests pass, build succeeds)
4. **Safety Controls**: Max iterations, timeouts
5. **Failure as Data**: Each failed attempt informs the next iteration

---

## Implementation: Unified Completion Checks

Everything about "when is the task done?" is a **check**. Checks can be:
- **Code-based**: Run tests, call APIs, check files
- **LLM-based**: Ask an LLM to evaluate

By default, the network uses an LLM check that asks "is this task complete?"

### Quick Start

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createCheck, taskCompletionCheck } from '@mastra/core/loop';

// Code-based check
const testsCheck = createCheck({
  id: 'tests',
  name: 'Unit Tests',
  args: { command: 'npm test' },
  run: async (params) => {
    const { execSync } = await import('child_process');
    try {
      execSync(params.args.command, { stdio: 'pipe' });
      return { passed: true, message: 'All tests passed' };
    } catch (e: any) {
      return { passed: false, message: 'Tests failed', details: { error: e.message } };
    }
  },
});

const agent = new Agent({
  id: 'code-migrator',
  instructions: 'You help migrate code between frameworks.',
  model: openai('gpt-4o'),
  memory: new Memory(),
  agents: { coder: codingAgent },
  
  // Default network options
  defaultNetworkOptions: {
    maxSteps: 20,
    completion: {
      checks: [testsCheck],
      strategy: 'all',
    },
  },
});

// Run network - uses default completion checks
const result = await agent.network('Migrate all tests from Jest to Vitest');

for await (const chunk of result.fullStream) {
  if (chunk.type === 'network-validation-end') {
    console.log(`Checks: ${chunk.payload.passed ? '✅' : '❌'}`);
  }
}
```

---

## API Reference

### Check Creators

```typescript
import { createCheck, createLLMCheck, taskCompletionCheck } from '@mastra/core/loop';

// Code-based check
const testsCheck = createCheck({
  id: 'tests',
  name: 'Unit Tests',
  args: { command: 'npm test' },
  run: async (params) => {
    // params.args.command - your static config
    // params.iteration - current iteration
    // params.messages - conversation history
    // params.originalTask - the task prompt
    // params.selectedPrimitive - { id, type }
    // params.primitiveResult - result from last execution
    
    return { passed: true, message: 'Tests passed' };
  },
});

// LLM-based check
const qualityCheck = createLLMCheck({
  id: 'quality',
  name: 'Code Quality Review',
  instructions: `
    Review the code changes and evaluate:
    - Are there any obvious bugs?
    - Is error handling adequate?
  `,
});

// The default completion check (can be included explicitly)
const defaultCheck = taskCompletionCheck({
  instructions: 'Only complete when all endpoints have tests',
});
```

### Completion Config

```typescript
interface CompletionConfig {
  // Checks to run (code or LLM)
  checks?: Check[];
  
  // All must pass, or any one
  strategy?: 'all' | 'any';
  
  // Timeout for all checks (ms)
  timeout?: number;
  
  // Run checks in parallel
  parallel?: boolean;
  
  // Callback after checks run
  onCheck?: (result: CheckRunResult) => void;
}
```

### Network Options

```typescript
interface NetworkOptions {
  maxSteps?: number;
  
  completion?: CompletionConfig;
  
  routing?: {
    additionalInstructions?: string;
    verboseIntrospection?: boolean;
  };
  
  memory?: AgentMemoryOption;
  onIterationComplete?: (ctx) => void;
}
```

---

## Usage Patterns

### 1. Default: LLM-only completion

```typescript
// No config - uses built-in LLM check
await agent.network('Build a landing page');
```

### 2. Code checks only

```typescript
await agent.network('Migrate to Vitest', {
  completion: {
    checks: [testsCheck, buildCheck],
  },
});
```

### 3. Default LLM + code checks

```typescript
await agent.network('Refactor auth', {
  completion: {
    checks: [
      taskCompletionCheck(), // Include default LLM check
      testsCheck,            // Plus code checks
    ],
  },
});
```

### 4. Custom LLM check

```typescript
await agent.network('Improve quality', {
  completion: {
    checks: [
      createLLMCheck({
        id: 'strict-quality',
        name: 'Strict Quality',
        instructions: 'Only complete when there are no TODO comments',
      }),
    ],
  },
});
```

### 5. Mixed checks

```typescript
await agent.network('Build API', {
  completion: {
    checks: [
      createLLMCheck({ instructions: 'All endpoints documented' }),
      testsCheck,
      createCheck({
        id: 'api',
        name: 'API Health',
        run: async () => {
          const res = await fetch('http://localhost:3000/health');
          return { passed: res.ok, message: res.ok ? 'Healthy' : 'Down' };
        },
      }),
    ],
    strategy: 'all',
  },
});
```

---

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    Agent Network Loop                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   1. Routing Agent selects primitive (agent/workflow/tool)      │
│                      ↓                                           │
│   2. Execute selected primitive                                  │
│                      ↓                                           │
│   3. LLM Completion Check (default)                             │
│      "Is this task complete?"                                    │
│                      ↓                                           │
│              ┌───────┴───────┐                                   │
│          LLM: No         LLM: Yes                                │
│              │               │                                   │
│              │               ▼                                   │
│              │    4. Run Additional Checks                       │
│              │       (if configured)                             │
│              │               │                                   │
│              │       ┌───────┴───────┐                          │
│              │   Checks         Checks                           │
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

## Stream Events

```typescript
for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'network-validation-start':
      console.log(`Running ${chunk.payload.checksCount} checks...`);
      break;
    case 'network-validation-end':
      console.log(`Checks: ${chunk.payload.passed ? '✅' : '❌'}`);
      break;
    case 'routing-agent-start':
      console.log(`Iteration ${chunk.payload.inputData.iteration}`);
      break;
  }
}
```
