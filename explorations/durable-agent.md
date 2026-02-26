# Durable Agents

This branch introduces **durable agent execution** to Mastra - the ability to run AI agent loops that survive server crashes, restarts, and failures.

## What Problem Does This Solve?

When an AI agent makes multiple tool calls in a conversation, each step is a potential failure point. If your server crashes mid-way through a 10-step agentic loop, you lose everything and have to start over.

With durable agents, the entire execution is checkpointed. If the server crashes after step 7, it resumes from step 7 - not from the beginning.

## What We Built

### 1. Core Durable Agent Infrastructure (`packages/core`)

**`DurableAgent` class** - A new agent type that separates preparation from execution:

- `prepare()` - Creates serializable workflow input (non-durable)
- The actual LLM calls happen inside a workflow (durable)
- Uses PubSub for streaming instead of closures (closures aren't serializable)

**Durable workflow steps** - Reusable building blocks:

- `createDurableLLMExecutionStep()` - Runs the LLM with tools
- `createDurableLLMMappingStep()` - Maps tool calls to tool results
- `emitFinishEvent()`, `emitErrorEvent()` - PubSub event helpers

**`DurableAgentLike` interface** - Contract for durable agent implementations:

```typescript
interface DurableAgentLike {
  id: string;
  name: string;
  agent: Agent;
  getDurableWorkflows?(): Workflow[];
}
```

### 2. Inngest Integration (`workflows/inngest`)

**`createInngestAgent()`** - Factory function to create durable agents powered by Inngest:

```typescript
const agent = new Agent({ id: 'my-agent', model: openai('gpt-4'), ... });
const durableAgent = createInngestAgent({ agent, inngest });

// Register with Mastra - workflow auto-registered
const mastra = new Mastra({ agents: { myAgent: durableAgent } });

// Use it
const { output, cleanup } = await durableAgent.stream('Hello!');
```

**`InngestPubSub`** - PubSub implementation using Inngest Realtime for streaming across process boundaries.

**Durable agentic workflow** - An Inngest workflow that:

- Receives serialized agent input
- Looks up the agent from Mastra by ID
- Runs the agentic loop with checkpointing at each step
- Streams results back via Inngest Realtime

### 3. Mastra Integration (`packages/core/src/mastra`)

Updated `addAgent()` to recognize `DurableAgentLike`:

- Automatically registers the underlying agent
- Automatically registers associated workflows
- No manual workflow registration needed

### 4. Shared Test Suite (`workflows/_test-utils`)

A comprehensive test factory that runs **170 tests** against any durable agent implementation:

- Constructor/prepare/stream basics
- Tool execution (single, multiple, concurrent)
- Tool approval and suspension
- Memory integration
- Structured output
- Usage tracking
- UI message handling
- Error handling
- And more...

The same tests run against:

- `DurableAgent` with `EventEmitterPubSub` (in-memory, for fast testing)
- `InngestAgent` with `InngestPubSub` (real Inngest, for integration testing)

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { createInngestAgent, serve as inngestServe } from '@mastra/inngest';
import { Mastra } from '@mastra/core/mastra';
import { Inngest } from 'inngest';
import { realtimeMiddleware } from '@inngest/realtime/middleware';

// 1. Create Inngest client
const inngest = new Inngest({
  id: 'my-app',
  middleware: [realtimeMiddleware()],
});

// 2. Create a regular agent
const agent = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'You are helpful',
  model: openai('gpt-4o'),
  tools: {
    /* your tools */
  },
});

// 3. Wrap with durable execution
const durableAgent = createInngestAgent({ agent, inngest });

// 4. Register with Mastra
const mastra = new Mastra({
  agents: { assistant: durableAgent },
  server: {
    apiRoutes: [
      {
        path: '/api/inngest',
        method: 'ALL',
        createHandler: async ({ mastra }) => inngestServe({ mastra, inngest }),
      },
    ],
  },
});

// 5. Use it - the entire loop is now durable
const { output, runId, cleanup } = await durableAgent.stream(
  [{ role: 'user', content: 'Analyze this data and create a report' }],
  {
    onChunk: chunk => {
      /* stream to client */
    },
    onStepFinish: step => {
      /* called after each LLM step */
    },
    onFinish: result => {
      /* called when done */
    },
  },
);

const text = await output.text;
cleanup();
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DurableAgent.stream()                        │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PREPARATION PHASE (non-durable)                  │
│                                                                     │
│  1. Resolve tools → store as { id, name, schema } (no execute fn)   │
│  2. Create MessageList, load memory, run input processors           │
│  3. Serialize: { messageListState, toolsMetadata, modelConfig, ... }│
│  4. Store non-serializable state in per-run registry                │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DURABLE AGENTIC LOOP (workflow)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  dowhile(shouldContinue)                                     │   │
│  │    │                                                         │   │
│  │    ▼                                                         │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ durableLLMExecutionStep                              │    │   │
│  │  │  - Deserialize messageList from inputData            │    │   │
│  │  │  - Resolve model from mastra via modelConfig         │    │   │
│  │  │  - Execute LLM call                                  │    │   │
│  │  │  - Emit chunks via pubsub (agent.stream.{runId})     │    │   │
│  │  │  - Serialize messageList to output                   │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │    │                                                         │   │
│  │    ▼                                                         │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ foreach(toolCalls) → durableToolCallStep             │    │   │
│  │  │  - Resolve tool from registry via toolName           │    │   │
│  │  │  - Check approval requirements                       │    │   │
│  │  │  - If needs approval: suspend with waitForEvent      │    │   │
│  │  │  - Execute tool                                      │    │   │
│  │  │  - Emit result via pubsub                            │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │    │                                                         │   │
│  │    ▼                                                         │   │
│  │  Check stopWhen condition                                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         OUTPUT (streaming)                          │
│                                                                     │
│  MastraModelOutput subscribes to pubsub channel                     │
│  Invokes callbacks (onChunk, onStepFinish, onFinish) as events arrive│
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/core/src/agent/durable/
├── index.ts                          # Exports
├── durable-agent.ts                  # DurableAgent class (extends Agent)
├── types.ts                          # DurableAgentState, DurableStepInput, etc.
├── constants.ts                      # AGENT_STREAM_TOPIC, etc.
├── run-registry.ts                   # Per-run tool/state registry
├── stream-adapter.ts                 # Pubsub → MastraModelOutput adapter
├── preparation.ts                    # Preparation phase logic
├── workflows/
│   ├── index.ts                      # Workflow exports
│   ├── create-durable-agentic-workflow.ts  # Main workflow factory
│   └── steps/
│       ├── index.ts                  # Step exports
│       ├── llm-execution.ts          # Durable LLM step
│       ├── tool-call.ts              # Durable tool call step
│       └── llm-mapping.ts           # Durable mapping step
└── utils/
    ├── index.ts                      # Utility exports
    ├── resolve-runtime.ts            # Resolve _internal, tools, etc.
    └── serialize-state.ts            # State serialization helpers
```

## Key Design Decisions

1. **Separation of concerns** - `DurableAgent` in core handles the abstraction, `InngestAgent` handles Inngest-specific implementation

2. **PubSub for streaming** - Closures can't be serialized, so we use PubSub to stream events across process boundaries

3. **Workflow auto-registration** - `getDurableWorkflows()` lets Mastra automatically register workflows when you add a durable agent

4. **Shared test suite** - One test suite, multiple implementations. Ensures parity between EventEmitter (fast) and Inngest (real) backends

5. **Tool registration** - Tools have `execute` functions that can't be serialized. During preparation, tool metadata (id, name, schema) is extracted for serialization. Actual tool objects are stored in a per-run registry on the DurableAgent and resolved at execution time.

6. **Runtime dependency resolution** - The `_internal` object contains non-serializable items (functions, class instances). These are split into serializable state that flows through the workflow and runtime dependencies that are resolved fresh at each step (memory from mastra, fresh ID generators, etc.).
