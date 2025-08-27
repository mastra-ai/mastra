# AI Tracing Event Spans Implementation Plan

## Overview

This document outlines the plan for implementing event spans for each chunk of text returned when models are streaming. Event spans will be created and immediately ended (with endTime 0) to capture real-time streaming events.

## Architecture Analysis

### Current Streaming Architecture

**V1 (model.ts)**: Uses `TransformStream` to wrap the original stream and has access to each chunk in the `transform()` method.

**V2 (loop-based)**: Uses a more complex architecture where chunks flow through the loop workflow system via `packages/core/src/loop/loop.ts`.

### Key Findings

1. **Chunk Types Available**: `text-delta`, `reasoning-delta`, `tool-call`, `finish`, etc.
2. **V1 Already Has Infrastructure**: TODO comment exists at exact location for implementation
3. **V2 Requires Deeper Integration**: Model wrapping alone insufficient - chunks processed in loop system

## Implementation Strategy

### Phase 1: V1 Implementation ✅ COMPLETED

**Location**: `packages/core/src/llm/model/model.ts` - `_wrapModel()` method

**Implementation**: Replaced existing TODO comment in `TransformStream.transform()`:

```typescript
transform(chunk, controller) {
  // Create event spans for text chunks
  if (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta') {
    const eventSpan = llmSpan.createChildSpan({
      type: AISpanType.LLM_CHUNK, // New span type for streaming events
      name: `llm chunk: ${chunk.type}`,
      input: chunk,
    });

    // Immediately end the span (event-style)
    eventSpan.end({
      output: chunk,
      endTime: 0, // As requested for event spans
    });
  }

  // Existing finish tracking...
  if (chunk.type === 'finish') {
    finishReason = chunk.finishReason;
    finalUsage = chunk.usage;
  }
  controller.enqueue(chunk);
}
```

**Benefits**:

- ✅ Works immediately for `generate()` and `stream()` methods
- ✅ Minimal code changes
- ✅ Consistent with existing patterns

### Phase 2: V2 Implementation - Loop-Level Integration ✅ COMPLETED

**Approach**: Deep integration throughout the V2 pipeline from `#execute()` through loop system.

#### Step 1: Extend Agent #execute() Method

**Location**: `packages/core/src/agent/index.ts` - `#execute()` method

**Implementation**: Pass `agentAISpan` through to loop system:

```typescript
// In #execute() method, when calling stream():
const loopOptions: LoopOptions<Tools, OUTPUT> = {
  messageList,
  model: this.#model,
  tools: tools as Tools,
  stopWhen,
  toolChoice,
  modelSettings,
  telemetry_settings: {
    ...this.experimental_telemetry,
    ...telemetry_settings,
  },
  output,
  outputProcessors,
  agentAISpan, // Pass the agent span to loop
  options: {
    // ... existing options
  },
};
```

#### Step 2: Update Loop Types

**Location**: `packages/core/src/loop/types.ts`

**Implementation**: Add AI tracing context to loop options:

```typescript
export interface LoopOptions<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined> {
  // ... existing properties
  agentAISpan?: AnyAISpan; // Add AI span context
}

export interface LoopRun<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined> {
  // ... existing properties
  agentAISpan?: AnyAISpan; // Add AI span context
}
```

#### Step 3: Update Loop Function

**Location**: `packages/core/src/loop/loop.ts`

**Implementation**: Pass AI span through to workflow stream:

```typescript
export function loop<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema | undefined = undefined>({
  model,
  logger,
  runId,
  idGenerator,
  telemetry_settings,
  messageList,
  includeRawChunks,
  modelSettings,
  tools,
  _internal,
  mode = 'stream',
  outputProcessors,
  agentAISpan, // Accept AI span
  ...rest
}: LoopOptions<Tools, OUTPUT>) {
  // ... existing setup code

  return new MastraModelOutput({
    stream: workflowLoopStream({
      messageList,
      model,
      tools,
      stopWhen: rest.stopWhen,
      toolChoice: rest.toolChoice,
      modelSettings,
      telemetry_settings,
      _internal: internalToUse,
      modelStreamSpan: rootSpan,
      agentAISpan, // Pass through to stream
      // ... other props
    }),
    // ... other props
  });
}
```

#### Step 4: Update Workflow Stream

**Location**: `packages/core/src/loop/workflow/stream.ts`

**Implementation**: Accept and use AI span in workflow stream:

```typescript
export function workflowLoopStream<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  messageList,
  model,
  tools,
  stopWhen,
  toolChoice,
  modelSettings,
  telemetry_settings,
  _internal,
  modelStreamSpan,
  agentAISpan, // Accept AI span
  ...rest
}: LoopRun<Tools, OUTPUT>) {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const writer = new WritableStream<ChunkType>({
        write: chunk => {
          // Create event spans for streaming chunks
          if (agentAISpan && (chunk.type === 'text-delta' || chunk.type === 'reasoning-delta')) {
            const eventSpan = agentAISpan.createChildSpan({
              type: AISpanType.LLM_CHUNK,
              name: `llm chunk: ${chunk.type}`,
              input: chunk,
            });

            // Immediately end the span (event-style)
            eventSpan.end({
              output: chunk,
              endTime: 0,
            });
          }

          controller.enqueue(chunk);
        },
      });

      // ... rest of workflow setup
    },
  });
}
```

#### Step 5: Update MastraLLMVNext

**Location**: `packages/core/src/llm/model/model.loop.ts`

**Implementation**: Pass AI span to loop function:

```typescript
stream<Tools extends ToolSet, OUTPUT extends OutputSchema | undefined = undefined>({
  messages,
  stopWhen = stepCountIs(5),
  tools = {} as Tools,
  runId,
  modelSettings,
  toolChoice = 'auto',
  telemetry_settings,
  threadId,
  resourceId,
  output,
  options,
  outputProcessors,
  agentAISpan, // Accept AI span parameter
  // ...rest
}: ModelLoopStreamArgs<Tools, OUTPUT>): MastraModelOutput<OUTPUT | undefined> {

  // ... existing setup code

  const loopOptions: LoopOptions<Tools, OUTPUT> = {
    messageList,
    model: this.#model,
    tools: tools as Tools,
    stopWhen,
    toolChoice,
    modelSettings,
    telemetry_settings: {
      ...this.experimental_telemetry,
      ...telemetry_settings,
    },
    output,
    outputProcessors,
    agentAISpan, // Pass AI span to loop
    options: {
      // ... existing options
    }
  };

  return loop(loopOptions);
}
```

## Required Changes Summary

### Phase 1: V1 (COMPLETED)

- [x] Add event span creation in `packages/core/src/llm/model/model.ts`
- [x] Add new `AISpanType.LLM_CHUNK` span type

### Phase 2: V2 Loop Integration (COMPLETED)

- [x] Update `packages/core/src/agent/index.ts` - Pass `agentAISpan` to model stream
- [x] Update `packages/core/src/loop/types.ts` - Add AI span to interfaces
- [x] Update `packages/core/src/loop/loop.ts` - Accept and pass through AI span
- [x] Update `packages/core/src/loop/workflow/stream.ts` - Implement event span creation
- [x] Update `packages/core/src/llm/model/model.loop.ts` - Accept AI span parameter
- [x] Update `packages/core/src/llm/model/model.loop.types.ts` - Add AI span to types (already present)

## Benefits

✅ **Comprehensive Coverage**: Event spans for both V1 and V2 streaming
✅ **Consistent Patterns**: Follows established AI tracing architecture  
✅ **Real-time Tracking**: Captures every streaming chunk as it flows
✅ **Minimal Performance Impact**: Event spans are created and ended immediately
✅ **Future-Ready**: Supports planned `span.event()` method enhancement

## Testing Strategy

1. **V1 Testing**: Verify event spans appear for `generate()` and `stream()` calls
2. **V2 Testing**: Verify event spans appear for `generateVNext()` and `streamVNext()` calls
3. **Integration Testing**: Ensure event spans are properly nested under agent spans
4. **Performance Testing**: Validate minimal overhead from event span creation

## Future Enhancements

- Add `span.event()` method for simplified event span creation
- Support additional chunk types (tool-call, function-call, etc.)
- Add configurable filtering of chunk types for event spans
- Implement span aggregation for high-frequency streaming
