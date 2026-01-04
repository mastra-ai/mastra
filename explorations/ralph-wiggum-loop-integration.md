# Ralph Wiggum Loop Integration for Mastra

> **Status: IMPLEMENTED** - The Agent Network with completion scorers IS the autonomous loop

## What is the Ralph Wiggum Loop?

The Ralph Wiggum loop is an autonomous agent execution pattern where an AI agent works persistently and iteratively until completion criteria are met. The core philosophy: **"Let the agent fail repeatedly until it succeeds."**

### Key Characteristics

1. **Persistent Iteration**: The agent loops continuously
2. **Context Preservation**: Each iteration sees results from previous runs
3. **Completion Criteria**: Clear success metrics (tests pass, build succeeds)
4. **Safety Controls**: Max iterations, timeouts
5. **Failure as Data**: Each failed attempt informs the next iteration

---

## Implementation: Scorers for Completion

Completion checks are just **MastraScorers** that return 0 (not complete) or 1 (complete).

This unifies:
- **Evals** (offline testing) 
- **Completion** (runtime loop control)

Same primitive, different contexts.

### Quick Start

```typescript
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { createScorer } from '@mastra/core/evals';
import { execSync } from 'child_process';

// Create a completion scorer
const testsScorer = createScorer({
  id: 'tests',
  description: 'Run unit tests to verify code works',
}).generateScore(async ({ run }) => {
  try {
    execSync('npm test', { stdio: 'pipe' });
    return 1; // Tests passed
  } catch {
    return 0; // Tests failed
  }
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
      scorers: [testsScorer],
      strategy: 'all',
    },
  },
});

// Run network - uses default completion scorers
const result = await agent.network('Migrate all tests from Jest to Vitest');

for await (const chunk of result.fullStream) {
  if (chunk.type === 'network-validation-end') {
    console.log(`Completion: ${chunk.payload.passed ? '✅' : '❌'}`);
  }
}
```

---

## Creating Completion Scorers

Scorers are created using `createScorer` from the evals module. For completion, they should return 0 or 1.

### Code-based Scorer

Scorers receive a `run` object with:
- `run.input` - `CompletionContext` with all network state
- `run.output` - The primitive's result (what we're evaluating)
- `run.runId` - The network run ID
- `run.requestContext` - Custom context from the request

```typescript
import { createScorer } from '@mastra/core/evals';

// Simple scorer - run tests
const testsScorer = createScorer({
  id: 'tests',
  description: 'Run unit tests',
}).generateScore(async () => {
  try {
    execSync('npm test', { stdio: 'pipe' });
    return 1;
  } catch {
    return 0;
  }
});

// Context-aware scorer - access full network state
const progressScorer = createScorer({
  id: 'progress',
  description: 'Check progress',
}).generateScore(async ({ run }) => {
  // run.input is CompletionContext
  const ctx = run.input;
  
  console.log(`Iteration: ${ctx.iteration}`);
  console.log(`Task: ${ctx.originalTask}`);
  console.log(`Primitive: ${ctx.selectedPrimitive.id}`);
  console.log(`Result: ${run.output}`); // Same as ctx.primitiveResult
  
  // Access messages history
  const hasCodeOutput = ctx.messages.some(m => 
    m.content?.includes?.('```')
  );
  
  return hasCodeOutput ? 1 : 0;
});

// Use custom request context
const envScorer = createScorer({
  id: 'env-check',
  description: 'Environment-aware check',
}).generateScore(async ({ run }) => {
  const isProd = run.requestContext?.env === 'production';
  // Stricter checks in prod
  return isProd ? runStrictChecks() : 1;
});
```

### LLM-based Scorer

Use this when you want LLM evaluation alongside code scorers:

```typescript
const taskCompleteScorer = createScorer({
  id: 'task-complete',
  description: 'LLM evaluates if task is complete',
  judge: {
    model: openai('gpt-4o-mini'),
    instructions: 'You evaluate task completion.',
  },
}).generateScore({
  description: 'Evaluate if the task is complete',
  createPrompt: ({ run }) => {
    const ctx = run.input; // CompletionContext
    return `
      Original task: ${ctx.originalTask}
      
      Latest result: ${ctx.primitiveResult}
      
      Is this task complete? Return 1 if yes, 0 if no.
    `;
  },
});

// Use LLM scorer + code scorer together
completion: {
  scorers: [taskCompleteScorer, testsScorer],
}
```

---

## Completion Config

```typescript
interface CompletionConfig {
  // Scorers to run (return 0 or 1)
  scorers?: MastraScorer[];
  
  // 'all' = all must pass, 'any' = one must pass
  strategy?: 'all' | 'any';
  
  // Timeout for all scorers (ms)
  timeout?: number;
  
  // Run scorers in parallel
  parallel?: boolean;
  
  // Callback after scoring
  onComplete?: (result: CompletionRunResult) => void;
}
```

---

## How Completion Works

**Everything goes through the completion check system.**

| Config | What Runs |
|--------|-----------|
| No `completion.scorers` | Default LLM check (structured output with `finalResult`) |
| `completion.scorers: [...]` | Only those scorers |

The default LLM check returns:
- `isComplete`: boolean
- `completionReason`: why it's complete or not
- `finalResult`: the final output to return

This metadata flows back into the network result.

---

## Usage Patterns

### 1. Default: LLM-only completion

```typescript
// No scorers - uses built-in LLM evaluation
await agent.network('Build a landing page');
```

### 2. Code scorers only (replaces LLM)

```typescript
// Scorers replace the default LLM check entirely
await agent.network('Migrate to Vitest', {
  completion: {
    scorers: [testsScorer, buildScorer],
  },
});
```

### 3. Mixed scorers

```typescript
await agent.network('Build API', {
  completion: {
    scorers: [
      testsScorer,      // Code-based
      qualityScorer,    // LLM-based
      apiScorer,        // Code-based
    ],
    strategy: 'all',
  },
});
```

### 4. Any-pass strategy

```typescript
await agent.network('Fix the bug', {
  completion: {
    scorers: [testsScorer, manualApprovalScorer],
    strategy: 'any', // Either tests pass OR manual approval
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
│   3. Run Completion Scorers                                      │
│      (default LLM scorer if none configured)                     │
│                      ↓                                           │
│              ┌───────┴───────┐                                   │
│          Score=0         Score=1                                 │
│          (not done)      (complete)                              │
│              │               │                                   │
│              ▼               ▼                                   │
│   4. Inject feedback    5. Complete! ✅                          │
│              │                                                   │
│              └──────────► Loop back to step 1                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stream Events

```typescript
for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'network-validation-start':
      console.log(`Running ${chunk.payload.checksCount} scorers...`);
      break;
    case 'network-validation-end':
      console.log(`Complete: ${chunk.payload.passed ? '✅' : '❌'}`);
      for (const scorer of chunk.payload.results) {
        console.log(`  ${scorer.scorerName}: ${scorer.score}`);
      }
      break;
    case 'routing-agent-start':
      console.log(`Iteration ${chunk.payload.inputData.iteration}`);
      break;
  }
}
```

---

## Benefits of Using Scorers

1. **Unified Primitives**: Same `createScorer` API for evals and completion
2. **Reusable**: Use your eval scorers as completion checks
3. **Composable**: Mix code and LLM scorers freely
4. **Observable**: Scorer results include score + reason
5. **Testable**: Scorers can be tested independently
