# DurableAgent Implementation Plan

## Overview

Create a `DurableAgent` class that extends `Agent` and makes the agentic loop durable by:

1. Serializing all state between workflow steps
2. Resolving tools/models at execution time (not via closures)
3. Emitting stream events via pubsub instead of controller
4. Supporting any execution engine (default, Inngest, Cloudflare, etc.)

## Problem Statement

The current agent implementation is not durable because:

1. **Closure-based state passing**: Workflows capture `controller`, `tools`, `models`, `_internal` via closures that can't be serialized
2. **`_internal` object mutations**: State changes happen outside workflow state and are lost on replay
3. **Functions passed by reference**: Tool `execute` functions and model objects aren't serializable
4. **ReadableStreamDefaultController**: Used directly for streaming, undefined on replay

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
├── plan.md                           # This file
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
│       └── llm-mapping.ts            # Durable mapping step
└── utils/
    ├── index.ts                      # Utility exports
    ├── resolve-runtime.ts            # Resolve _internal, tools, etc.
    └── serialize-state.ts            # State serialization helpers
```

## Key Decisions

### 1. Tool Registration Strategy

**Problem**: Tools have `execute` functions that can't be serialized.

**Solution**: Hybrid approach with per-run registry

- During preparation, run `convertTools()` to get the full set of tools
- Extract tool metadata (id, name, schema, flags) for serialization into workflow state
- Store actual tool objects in a per-run registry (keyed by runId) on DurableAgent
- At execution time, resolve tools from the per-run registry

```typescript
// DurableAgent maintains a run-scoped tool registry
private runRegistries = new Map<string, RunRegistry>();

// During preparation:
const tools = await this.convertTools(...);
this.runRegistries.set(runId, { tools, ... });

// Workflow input contains only metadata (serializable):
const toolsMetadata = Object.entries(tools).map(([name, tool]) => ({
  id: tool.id,
  name,
  description: tool.description,
  inputSchema: zodToJsonSchema(tool.inputSchema),
  requireApproval: tool.requireApproval,
}));

// At execution time in durable step:
const tools = durableAgent.getToolsForRun(runId);
```

### 2. Handling `_internal` Object

**Problem**: `_internal` contains non-serializable objects (functions, class instances).

**Analysis of `_internal` (StreamInternal) properties**:
| Property | Serializable? | Resolution Strategy |
|----------|---------------|---------------------|
| `now` | NO (function) | Create fresh: `() => Date.now()` |
| `generateId` | NO (function) | Create fresh: `() => crypto.randomUUID()` |
| `currentDate` | NO (function) | Create fresh: `() => new Date()` |
| `saveQueueManager` | NO (class) | Create fresh from mastra.getMemory() |
| `memoryConfig` | YES | Serialize in workflow state |
| `threadId` | YES | Serialize in workflow state |
| `resourceId` | YES | Serialize in workflow state |
| `memory` | NO (class) | Resolve from mastra.getMemory() |
| `threadExists` | YES | Serialize in workflow state |
| `stepTools` | NO (functions) | Resolve from run registry |

**Solution**: Split into serializable state + runtime resolution

```typescript
// Serializable state (flows through workflow):
interface DurableAgentState {
  memoryConfig?: MemoryConfig;
  threadId?: string;
  resourceId?: string;
  threadExists?: boolean;
}

// Runtime resolution in durable steps:
function resolveRuntimeDependencies({ mastra, runId, inputData }) {
  const memory = mastra?.getMemory();
  return {
    now: () => Date.now(),
    generateId: () => crypto.randomUUID(),
    currentDate: () => new Date(),
    saveQueueManager: new SaveQueueManager({ logger: mastra.getLogger(), memory }),
    memory,
    ...inputData.state, // serializable parts
  };
}
```

### 3. PubSub Channel for Agent Streaming

**Problem**: Current implementation uses `ReadableStreamDefaultController.enqueue()` which is not available on replay.

**Solution**: Dedicated pubsub channel for agent streaming

```typescript
// Channel naming convention
const AGENT_STREAM_TOPIC = (runId: string) => `agent.stream.${runId}`;

// Event types emitted on the channel
type AgentStreamEvent = {
  type: 'chunk' | 'step-start' | 'step-finish' | 'finish' | 'error' | 'suspended';
  runId: string;
  data: any;
};

// In durable steps, emit via pubsub (accessed via PUBSUB_SYMBOL):
await pubsub.publish(AGENT_STREAM_TOPIC(runId), {
  type: 'chunk',
  runId,
  data: chunk,
});

// Stream adapter subscribes to pubsub and converts to ReadableStream
```

## Implementation Phases

### Phase 1: Foundation

- [x] Create plan.md
- [ ] Create types.ts with all type definitions
- [ ] Create constants.ts with channel names
- [ ] Create run-registry.ts for per-run state storage

### Phase 2: Utilities

- [ ] Create serialize-state.ts with serialization helpers
- [ ] Create resolve-runtime.ts for runtime dependency resolution

### Phase 3: Stream Adapter

- [ ] Create stream-adapter.ts to convert pubsub events to MastraModelOutput

### Phase 4: Durable Steps

- [ ] Create llm-execution.ts (durable LLM step)
- [ ] Create tool-call.ts (durable tool call step)
- [ ] Create llm-mapping.ts (durable mapping step)

### Phase 5: Workflow

- [ ] Create create-durable-agentic-workflow.ts

### Phase 6: Preparation

- [ ] Create preparation.ts with preparation phase logic

### Phase 7: DurableAgent Class

- [ ] Create durable-agent.ts extending Agent
- [ ] Override stream() method
- [ ] Implement generate() method

### Phase 8: Tests

- [ ] Serialization tests
- [ ] Tool resolution tests
- [ ] Stream adapter tests
- [ ] Integration tests with default engine

## Testing Strategy

1. **Serialization tests**: Verify all state types serialize/deserialize correctly
2. **Tool resolution tests**: Verify tools resolve from run registry
3. **Stream tests**: Verify pubsub events convert to correct stream chunks
4. **Integration tests**: Run same prompts through Agent and DurableAgent, compare outputs
5. **Suspend/resume tests**: Verify tool approval flow works with serialized state

## Notes

- All engines have at least the default pubsub (EventEmitterPubSub) through the Mastra class
- Tools should work exactly as they do today - resolve at execution time
- Callbacks (onChunk, onFinish, etc.) should work the same as current Agent
- For testing, use the default execution engine (no actual durability, but validates serialization)
