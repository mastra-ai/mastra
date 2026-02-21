# Agent Stream Architecture

> Mastra's tool-based supervisor pattern via `agent.stream()` / `agent.generate()`

**Created:** February 2026
**Source:** [packages/core/src/agent/agent.ts](../../packages/core/src/agent/agent.ts)

---

## 1. Overview

`agent.stream()` and `agent.generate()` implement a **tool-based supervisor pattern** where sub-agents are automatically converted to tools, and the LLM implicitly decides which to invoke via tool calls.

### Key Characteristics

| Aspect | Description |
|--------|-------------|
| Routing | Implicit - LLM decides via tool selection |
| Sub-agent invocation | Via auto-generated tools |
| Memory | Optional |
| Completion validation | Via `stopWhen` predicates |

---

## 2. Architecture

### 2.1 Sub-agents as Tools

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENT CONFIGURATION                          │
│                                                                      │
│  const supervisor = new Agent({                                      │
│    id: 'supervisor',                                                 │
│    instructions: 'Coordinate research and writing',                  │
│    model: 'openai/gpt-4',                                           │
│                                                                      │
│    // Sub-agents become tools automatically                          │
│    agents: {                                                         │
│      researcher: researchAgent,                                      │
│      writer: writerAgent,                                           │
│    },                                                                │
│                                                                      │
│    // Regular tools also available                                   │
│    tools: { searchWeb, calculateSum },                              │
│  });                                                                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         AVAILABLE TOOLS                              │
│                                                                      │
│  [                                                                   │
│    { name: 'searchWeb', ... },         // Regular tool               │
│    { name: 'calculateSum', ... },      // Regular tool               │
│    { name: 'agent-researcher', ... },  // Auto-generated from agent  │
│    { name: 'agent-writer', ... },      // Auto-generated from agent  │
│  ]                                                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Tool Generation via listAgentTools()

```typescript
// packages/core/src/agent/agent.ts:2130-2364
listAgentTools(): Record<string, CoreTool> {
  const agentTools: Record<string, CoreTool> = {};

  for (const [name, agent] of Object.entries(this.agents)) {
    agentTools[`agent-${name}`] = {
      description: `Delegate to ${name} agent: ${agent.instructions}`,
      parameters: z.object({
        prompt: z.string().describe('The prompt to send to the agent'),
        threadId: z.string().nullish(),
        resourceId: z.string().nullish(),
        instructions: z.string().nullish(),
        maxSteps: z.number().min(3).nullish(),
      }),
      execute: async (args) => {
        const result = await agent.generate(args.prompt, {
          threadId: args.threadId,
          resourceId: args.resourceId,
          instructions: args.instructions,
          maxSteps: args.maxSteps ?? 5,
        });
        return { text: result.text };
      },
    };
  }

  return agentTools;
}
```

---

## 3. Execution Flow

### 3.1 Agentic Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                         AGENTIC LOOP                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  LLM Execution Step                          │   │
│  │                                                              │   │
│  │  1. Process input processors                                 │   │
│  │  2. Call LLM with all tools (including sub-agent tools)     │   │
│  │  3. Process output processors                                │   │
│  │  4. Return: text + toolCalls[]                              │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Tool Call Step                              │   │
│  │                                                              │   │
│  │  For each toolCall:                                          │   │
│  │    - If regular tool: execute directly                       │   │
│  │    - If agent-* tool: invoke sub-agent.generate()           │   │
│  │  Return results to LLM                                       │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                        │
│                             ▼                                        │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  Continue Decision                           │   │
│  │                                                              │   │
│  │  Continue if:                                                │   │
│  │    - stepResult.isContinued === true                        │   │
│  │    - AND NOT stopWhen condition met                         │   │
│  │    - AND NOT maxSteps exceeded                              │   │
│  │    - AND finishReason !== 'stop'                            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 LLM Decides Routing

The LLM sees sub-agent tools alongside regular tools:

```typescript
// What the LLM sees:
{
  tools: [
    {
      name: 'agent-researcher',
      description: 'Delegate to researcher agent: Find accurate information',
      parameters: { prompt: string, ... }
    },
    {
      name: 'agent-writer',
      description: 'Delegate to writer agent: Write clear content',
      parameters: { prompt: string, ... }
    },
    {
      name: 'searchWeb',
      description: 'Search the web for information',
      parameters: { query: string }
    }
  ]
}

// LLM response might include:
{
  toolCalls: [
    { name: 'agent-researcher', args: { prompt: 'Research quantum computing' } }
  ]
}
```

---

## 4. Configuration

### 4.1 Stream Options

```typescript
interface StreamOptions {
  // Iteration control
  maxSteps?: number;
  stopWhen?: StopCondition | StopCondition[];

  // Memory (optional)
  memory?: MemoryConfig;
  threadId?: string;
  resourceId?: string;

  // Tool execution
  toolCallConcurrency?: number;

  // Callbacks
  onStepFinish?: (step: StepResult) => void;
  onFinish?: (result: FinalResult) => void;
}
```

### 4.2 Stop Conditions

```typescript
// packages/core/src/loop/types.ts
type StopCondition = (context: StopContext) => boolean | Promise<boolean>;

// Usage
const result = await supervisor.stream('Write a paper', {
  maxSteps: 20,
  stopWhen: [
    // Stop when text contains conclusion
    ({ text }) => text.includes('## Conclusion'),
    // Stop after 5 iterations
    ({ stepCount }) => stepCount >= 5,
  ],
});
```

---

## 5. Key Features

### 5.1 Implicit Routing

The LLM naturally decides which tool to call:
- No separate routing step
- No extra LLM call
- Decision embedded in response

### 5.2 Tool Concurrency

Multiple tools can execute in parallel:

```typescript
const result = await supervisor.stream('Analyze data', {
  toolCallConcurrency: 3, // Up to 3 tools at once
});
```

### 5.3 Streaming Support

Full streaming of LLM responses:

```typescript
const result = await supervisor.stream('Write a paper');

for await (const chunk of result.fullStream) {
  if (chunk.type === 'text-delta') {
    process.stdout.write(chunk.payload.text);
  }
  if (chunk.type === 'tool-call') {
    console.log(`Calling: ${chunk.payload.name}`);
  }
}
```

---

## 6. Current Limitations

### 6.1 No Completion Scoring

Stream lacks built-in scorer support:
- Must use `stopWhen` predicates
- No multi-criteria validation
- No automatic feedback to LLM

### 6.2 Limited Sub-agent Context

Sub-agents only receive the prompt:
- No conversation history
- No filtered context
- Less coordination capability

### 6.3 No Delegation Observability

No hooks for delegation events:
- Can't observe when sub-agents are called
- Can't intercept or modify delegation
- Limited debugging capability

### 6.4 No Early Termination (Bail)

Can't skip supervisor synthesis:
- Always returns to supervisor after sub-agent
- Extra tokens for synthesis
- Higher latency

---

## 7. Comparison with Network

| Aspect | Stream | Network |
|--------|--------|---------|
| Routing | Implicit (tool calls) | Explicit (routing agent) |
| Extra LLM call | No | Yes (for routing) |
| Memory | Optional | Required |
| Sub-agent context | Just prompt | Filtered history |
| Completion scoring | No | Yes |
| Complexity | Lower | Higher |
| Latency | Lower | Higher |

---

## 8. When to Use Stream

**Use stream when:**
- Simple delegation is sufficient
- Lower latency is important
- Memory is optional
- Don't need completion scoring

**Use network instead when:**
- Need explicit routing decisions
- Require completion validation
- Want filtered context for sub-agents
- Need iteration hooks

---

## 9. Related Files

- [packages/core/src/agent/agent.ts](../../packages/core/src/agent/agent.ts) - Agent class with listAgentTools()
- [packages/core/src/loop/workflows/agentic-loop/index.ts](../../packages/core/src/loop/workflows/agentic-loop/index.ts) - Agentic loop
- [packages/core/src/loop/types.ts](../../packages/core/src/loop/types.ts) - Loop types
