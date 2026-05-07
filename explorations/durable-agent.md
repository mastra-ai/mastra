# Durable Agents

This branch introduces **durable agent execution** to Mastra - the ability to run AI agent loops that survive server crashes, restarts, and failures, with resumable streams that survive client disconnections.

## What Problem Does This Solve?

**Server-side:** When an AI agent makes multiple tool calls in a conversation, each step is a potential failure point. If your server crashes mid-way through a 10-step agentic loop, you lose everything and have to start over. With durable agents, the entire execution is checkpointed. If the server crashes after step 7, it resumes from step 7 - not from the beginning.

**Client-side:** When a client disconnects mid-stream (network blip, page refresh), the stream is lost. With resumable streams, the client can reconnect and replay missed events from a cached history, picking up exactly where it left off.

## Three Patterns

The architecture supports three increasingly durable patterns:

1. **`createDurableAgent`** — Resumable streams only. Execution stays in the HTTP request. Use when you want reconnection support but don't need durable execution.

2. **`createEventedAgent`** — Resumable streams + fire-and-forget execution via workflow engine. The LLM loop runs in a local workflow, decoupled from the HTTP request. Use for long-running operations on single-instance deployments.

3. **`createInngestAgent`** — Resumable streams + Inngest-powered durable execution. The LLM loop runs as an Inngest function with checkpointing, retries, and cross-process streaming. Use for production distributed systems.

## What We Built

### 1. Core Durable Agent Infrastructure (`packages/core`)

**`DurableAgent` class** — Extends `Agent` and separates preparation from execution:

- `stream()` — Prepare and execute in one call, returning a `MastraModelOutput` with streaming callbacks
- `prepare()` — Creates serializable workflow input (non-durable) and populates the run registry
- `resume()` — Resume a suspended workflow execution (e.g., after tool approval)
- `observe()` — Reconnect to an existing stream by `runId`, optionally from an offset, replaying missed events via `CachingPubSub`

**`EventedAgent` class** — Extends `DurableAgent` to fire execution into the workflow engine (fire-and-forget). The HTTP handler returns immediately after `prepare()`, and the agent loop runs in a background workflow.

**Durable workflow steps** — Reusable building blocks for the agentic loop:

- `createDurableLLMExecutionStep()` — Runs the LLM with tools, emits chunks via PubSub
- `createDurableToolCallStep()` — Resolves tools, handles approval/suspension, persists messages before suspend
- `createDurableLLMMappingStep()` — Maps tool calls to individual tool call step inputs
- `createDurableScorerExecutionStep()` — Runs configured scorers after each step

**Run registry** — Per-run storage for non-serializable state:

- `RunRegistry` — Instance-level registry on each DurableAgent
- `ExtendedRunRegistry` — Adds MessageList and memory info tracking
- `globalRunRegistry` — Module-level TTLCache (10min TTL, 1000 entry cap) for accessing run state from workflow steps. Includes a `dispose` callback that calls `entry.cleanup()` on eviction/expiry.

**PubSub system** — Event streaming across process boundaries:

- `PubSub` (abstract base) — Subscribe/publish/unsubscribe contract
- `EventEmitterPubSub` — In-memory implementation using Node.js EventEmitter
- `CachingPubSub` — Decorator that adds event caching and replay to any PubSub. Enables `subscribeWithReplay()` and `subscribeFromOffset()` for resumable streams.
- `InngestPubSub` (in `workflows/inngest`) — Implementation using Inngest Realtime

**`MastraServerCache`** — Abstract cache interface used by `CachingPubSub`:

- `InMemoryServerCache` — In-memory implementation
- Redis implementations available via separate packages

**Stream adapter** (`stream-adapter.ts`) — Bridges PubSub events to `MastraModelOutput`:

- `createDurableAgentStream()` — Creates a `ReadableStream` that subscribes to PubSub, translates events into chunks, and drives `MastraModelOutput` callbacks (onChunk, onStepFinish, onFinish, onError, onSuspended)
- Handles subscribe/cancel race condition with a `cancelled` flag
- Emit helpers: `emitChunkEvent()`, `emitErrorEvent()`, `emitSuspendedEvent()`, `emitStepFinishEvent()`, `emitFinishEvent()`

### 2. Inngest Integration (`workflows/inngest`)

**`createInngestAgent()`** — Factory function to create durable agents powered by Inngest:

```typescript
const agent = new Agent({ id: 'my-agent', model: openai('gpt-4'), ... });
const durableAgent = createInngestAgent({ agent, inngest });
const mastra = new Mastra({ agents: { myAgent: durableAgent } });
```

**`InngestPubSub`** — PubSub implementation using Inngest Realtime for streaming across process boundaries.

**Durable agentic workflow** — An Inngest function that receives serialized agent input, resolves the agent from Mastra by ID, runs the agentic loop with checkpointing at each step, and streams results back via Inngest Realtime.

### 3. Server Endpoints (`packages/server`)

Two HTTP endpoints for client interaction with durable agents:

- **`POST /agents/:agentId/observe`** — Reconnect to an existing stream by runId. Supports `offset` for partial replay. Returns an SSE stream of events.
- **`POST /agents/:agentId/resume-stream`** — Resume a suspended agent execution with new data (e.g., tool approval). Returns an SSE stream of the continued execution.

### 4. Mastra Integration (`packages/core/src/mastra`)

`addAgent()` recognizes `DurableAgentLike`:

- Automatically registers the underlying agent
- Automatically registers associated workflows via `getDurableWorkflows()`
- No manual workflow registration needed

### 5. Test Suite

22 test files under `packages/core/src/agent/durable/__tests__/` covering:

- Core DurableAgent operations (stream, prepare, resume)
- Tool execution (single, multiple, concurrent, workflow-based)
- Tool approval and in-execution suspension
- Memory integration
- Structured output
- Usage tracking
- UI message handling
- Reasoning/thinking mode
- Image inputs
- Model fallback
- Request context propagation
- Scorers
- Stop conditions
- Resumable streams
- Cache TTL behavior
- And more

Additionally, a shared test factory in `workflows/_test-utils/` runs against multiple implementations (EventEmitter for fast testing, Inngest for integration testing).

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { createInngestAgent } from '@mastra/inngest';
import { Mastra } from '@mastra/core/mastra';

// Create a regular agent
const agent = new Agent({
  id: 'assistant',
  name: 'Assistant',
  instructions: 'You are helpful',
  model: openai('gpt-4o'),
  tools: {
    /* your tools */
  },
});

// Pattern 1: Resumable streams only
const durableAgent = createDurableAgent({ agent });

// Pattern 2: Resumable streams + workflow engine execution
const eventedAgent = createEventedAgent({ agent, pubsub });

// Pattern 3: Resumable streams + Inngest execution
const inngestAgent = createInngestAgent({ agent, inngest });

// Register with Mastra (cache and pubsub can be inherited)
const mastra = new Mastra({
  agents: { assistant: durableAgent },
});

// Stream
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

// Reconnect after disconnect (replays missed events)
const { output: reconnected } = await durableAgent.observe(runId, {
  offset: lastSeenIndex, // replay from this point
  onChunk: chunk => {
    /* stream to client */
  },
});

// Resume after suspension (e.g., tool approval)
const { output: resumed } = await durableAgent.resume(runId, { approved: true });
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
│  4. Store non-serializable state in per-run registry + global       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                    ┌─────────────┴──────────────┐
                    ▼                            ▼
        ┌──────────────────┐        ┌──────────────────────┐
        │ LocalExecutor    │        │ InngestExecutor       │
        │ (in-process)     │        │ (Inngest function)    │
        └────────┬─────────┘        └──────────┬───────────┘
                 │                              │
                 ▼                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   DURABLE AGENTIC LOOP (workflow)                   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  dowhile(shouldContinue)                                     │   │
│  │    │                                                         │   │
│  │    ▼                                                         │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ durableLLMExecutionStep                              │    │   │
│  │  │  - Deserialize messageList from workflow state       │    │   │
│  │  │  - Resolve model from mastra via modelConfig         │    │   │
│  │  │  - Execute LLM call                                  │    │   │
│  │  │  - Emit chunks via PubSub (agent.stream.{runId})     │    │   │
│  │  │  - Serialize messageList to output                   │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │    │                                                         │   │
│  │    ▼                                                         │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ foreach(toolCalls) → durableToolCallStep             │    │   │
│  │  │  - Resolve tool from registry via toolName           │    │   │
│  │  │  - Check approval requirements                       │    │   │
│  │  │  - If needs approval: flush messages, suspend         │    │   │
│  │  │  - Execute tool (with suspend callback for mid-exec)  │    │   │
│  │  │  - Emit result/error via PubSub                      │    │   │
│  │  │  - Background task execution support                  │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │    │                                                         │   │
│  │    ▼                                                         │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │ scorerExecutionStep (optional)                       │    │   │
│  │  │  - Run configured scorers against output             │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │    │                                                         │   │
│  │    ▼                                                         │   │
│  │  Check stopWhen / maxSteps condition                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  On finish: run output processors, persist messages to memory       │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      OUTPUT (resumable streaming)                    │
│                                                                     │
│  CachingPubSub caches events for replay                             │
│  createDurableAgentStream subscribes to PubSub channel              │
│  Drives MastraModelOutput callbacks (onChunk, onStepFinish, etc.)   │
│  observe() reconnects with subscribeFromOffset for missed events    │
│  resume() creates new stream + resumes suspended workflow           │
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
packages/core/src/agent/durable/
├── index.ts                          # Exports
├── durable-agent.ts                  # DurableAgent class (extends Agent)
├── evented-agent.ts                  # EventedAgent class (extends DurableAgent)
├── create-durable-agent.ts           # createDurableAgent() factory
├── create-evented-agent.ts           # createEventedAgent() factory
├── types.ts                          # DurableAgentState, DurableStepInput, etc.
├── constants.ts                      # AGENT_STREAM_TOPIC, step IDs, defaults
├── run-registry.ts                   # RunRegistry, ExtendedRunRegistry, globalRunRegistry
├── stream-adapter.ts                 # PubSub → MastraModelOutput adapter + emit helpers
├── preparation.ts                    # Preparation phase logic
├── workflows/
│   ├── index.ts                      # Workflow exports
│   ├── create-durable-agentic-workflow.ts  # Main workflow factory
│   ├── shared/
│   │   ├── index.ts                  # Shared utility exports
│   │   ├── execute-tool-calls.ts     # Tool call execution helpers
│   │   ├── iteration-state.ts        # Iteration state management
│   │   └── schemas.ts               # Shared Zod schemas
│   └── steps/
│       ├── index.ts                  # Step exports
│       ├── llm-execution.ts          # Durable LLM step
│       ├── tool-call.ts              # Durable tool call step (approval + suspension)
│       ├── llm-mapping.ts            # Durable mapping step
│       └── scorer-execution.ts       # Durable scorer step
├── utils/
│   ├── index.ts                      # Utility exports
│   ├── resolve-runtime.ts            # Resolve tools, approval, runtime deps
│   └── serialize-state.ts            # State serialization helpers
└── __tests__/                        # 22 test files

packages/core/src/events/
├── pubsub.ts                         # Abstract PubSub base class
├── event-emitter.ts                  # EventEmitterPubSub (in-memory)
├── caching-pubsub.ts                 # CachingPubSub (adds replay to any PubSub)
├── types.ts                          # Event, EventCallback types
├── processor.ts                      # Event processor
└── index.ts                          # Exports

workflows/inngest/
├── src/
│   ├── durable-agent/
│   │   ├── create-inngest-agent.ts   # createInngestAgent() factory
│   │   └── create-inngest-agentic-workflow.ts  # Inngest workflow
│   ├── pubsub.ts                     # InngestPubSub
│   ├── execution-engine.ts           # Inngest execution engine
│   ├── serve.ts                      # Inngest serve handler
│   └── index.ts                      # Exports
└── ...
```

## Key Design Decisions

1. **Three-tier durability** — `DurableAgent` (resumable streams), `EventedAgent` (+ workflow execution), `InngestAgent` (+ distributed durability). Each tier builds on the previous.

2. **Direct workflow execution** — `DurableAgent` runs the workflow directly via `workflow.createRun()` + `run.start()`. `EventedAgent` overrides this to use `run.startAsync()` for fire-and-forget execution. `InngestAgent` (from `@mastra/inngest`) overrides it to dispatch via Inngest.

3. **PubSub for streaming** — Closures can't be serialized, so PubSub streams events across process boundaries. `CachingPubSub` wraps any PubSub to add event caching and replay for resumable streams.

4. **Separation of concerns** — Preparation (non-durable) creates serializable state. Execution (durable) runs in a workflow. Streaming (resumable) uses cached PubSub events.

5. **Tool registration** — Tools have `execute` functions that can't be serialized. During preparation, tool metadata (id, name, schema) is extracted for serialization. Actual tool objects are stored in a per-run registry and resolved at execution time.

6. **Message persistence before suspension** — Before any workflow suspension (tool approval, in-execution suspend), messages are flushed to memory via `SaveQueueManager`, matching the non-durable agent's behavior.

7. **Global run registry with TTL** — `globalRunRegistry` uses `TTLCache` (10min, 1000 entries) so workflow steps can access non-serializable run state. Entries are auto-cleaned on expiry via a `dispose` callback.

8. **Workflow auto-registration** — `getDurableWorkflows()` lets Mastra automatically register workflows when you add a durable agent. No manual workflow wiring needed.
