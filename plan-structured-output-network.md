# Implementation Plan: Add Structured Output to Network Result

## Issue Summary
GitHub Issue #11337 requests the ability to make the Agent Network output structured, similar to how regular agents support structured output via a schema.

## Current State Analysis

### How Agent Network Works
- `agent.network(messages, options)` returns a `MastraAgentNetworkStream`
- The stream emits chunks including `network-execution-event-finish` with `NetworkFinishPayload`
- Current `NetworkFinishPayload.result` is always a `string`

### How Agent Structured Output Works
- `agent.stream(prompt, { structuredOutput: { schema } })` returns `MastraModelOutput<OUTPUT>`
- The output has:
  - `.object` - Promise resolving to typed object
  - `.objectStream` - Stream of partial objects during generation
- Uses `tryGenerateWithJsonFallback()` utility for LLM-based structured output

### Network Internal Structured Output Usage
- Routing agent already uses structured output for primitive selection (line 393-401 in `network/index.ts`)
- `generateFinalResult()` in `validation.ts` already uses a schema for final result generation
- The infrastructure for structured output exists within the network loop

## Implementation Plan

### 1. Update Types (`packages/core/src/agent/agent.types.ts`)

Add `structuredOutput` option to `NetworkOptions`:

```typescript
export type NetworkOptions<OUTPUT extends OutputSchema = undefined> = {
  // ... existing options

  /**
   * Structured output configuration for the network's final result.
   * When provided, the network will generate a structured response matching the schema.
   *
   * @example
   * ```typescript
   * await agent.network(messages, {
   *   structuredOutput: {
   *     schema: z.object({
   *       summary: z.string(),
   *       recommendations: z.array(z.string()),
   *       confidence: z.number(),
   *     }),
   *   },
   * });
   * ```
   */
  structuredOutput?: StructuredOutputOptions<OUTPUT extends OutputSchema ? OUTPUT : never>;
};
```

### 2. Update Stream Types (`packages/core/src/stream/types.ts`)

Add generic support and new chunk types:

```typescript
// Add generic OUTPUT to NetworkFinishPayload
interface NetworkFinishPayload<OUTPUT extends OutputSchema = undefined> {
  task: string;
  primitiveId: string;
  primitiveType: string;
  prompt: string;
  result: string;
  object?: InferSchemaOutput<OUTPUT>;  // NEW: structured object when schema provided
  isComplete?: boolean;
  completionReason: string;
  iteration: number;
  threadId?: string;
  threadResourceId?: string;
  isOneOff: boolean;
  usage: LanguageModelUsage;
}

// Add new chunk types for streaming structured output
export type NetworkChunkType<OUTPUT extends OutputSchema = undefined> =
  // ... existing chunk types
  | (BaseChunkType & { type: 'network-object'; object: PartialSchemaOutput<OUTPUT> })
  | (BaseChunkType & { type: 'network-object-result'; object: InferSchemaOutput<OUTPUT> });
```

### 3. Enhance MastraAgentNetworkStream (`packages/core/src/stream/MastraAgentNetworkStream.ts`)

Add generic type parameter and structured output support:

```typescript
export class MastraAgentNetworkStream<OUTPUT extends OutputSchema = undefined> extends ReadableStream<ChunkType> {
  #objectPromise: DelayedPromise<InferSchemaOutput<OUTPUT>>;

  // ... existing constructor logic

  /**
   * Resolves to the structured object when the network completes.
   * Only available when structuredOutput option is provided.
   */
  get object(): Promise<InferSchemaOutput<OUTPUT>> {
    return this.#objectPromise.promise;
  }

  /**
   * Stream of partial objects during structured output generation.
   */
  get objectStream(): ReadableStream<PartialSchemaOutput<OUTPUT>> {
    return this.pipeThrough(
      new TransformStream<ChunkType, PartialSchemaOutput<OUTPUT>>({
        transform(chunk, controller) {
          if (chunk.type === 'network-object') {
            controller.enqueue(chunk.object);
          }
        },
      })
    );
  }
}
```

### 4. Update Validation Module (`packages/core/src/loop/network/validation.ts`)

Modify `generateFinalResult()` to accept user schema:

```typescript
export async function generateFinalResult<OUTPUT extends OutputSchema = undefined>(
  agent: Agent,
  context: CompletionContext,
  streamContext?: {
    writer?: { write: (chunk: NetworkChunkType) => Promise<void> };
    stepId?: string;
    runId?: string;
  },
  structuredOutputOptions?: StructuredOutputOptions<OUTPUT>,
): Promise<{ text?: string; object?: InferSchemaOutput<OUTPUT> }> {
  // If user provided a schema, use it for structured output
  if (structuredOutputOptions?.schema) {
    const prompt = buildFinalResultPrompt(context);

    const stream = await agent.stream(prompt, {
      maxSteps: 1,
      structuredOutput: structuredOutputOptions,
    });

    // Stream partial objects
    for await (const partialObject of stream.objectStream) {
      if (streamContext?.writer) {
        await streamContext.writer.write({
          type: 'network-object',
          object: partialObject,
          from: ChunkFrom.NETWORK,
          runId: streamContext.runId,
        });
      }
    }

    const result = await stream.getFullOutput();
    return { object: result.object };
  }

  // Existing text-based final result generation
  // ...
}
```

### 5. Update Network Loop (`packages/core/src/loop/network/index.ts`)

Pass structured output options through to final result generation:

```typescript
// In the finish step, when generating final result:
if (structuredOutputOptions?.schema) {
  const finalResultData = await generateFinalResult(
    routingAgentToUse,
    completionContext,
    { writer, stepId: generateId(), runId },
    structuredOutputOptions,
  );

  // Emit object-result chunk
  await writer.write({
    type: 'network-object-result',
    object: finalResultData.object,
    from: ChunkFrom.NETWORK,
    runId,
  });

  finishPayload.object = finalResultData.object;
} else {
  // Existing text-based result handling
}
```

### 6. Update Agent Class (`packages/core/src/agent/agent.ts`)

Update the `network()` method signature to accept generic:

```typescript
async network<OUTPUT extends OutputSchema = undefined>(
  messages: MessageListInput,
  options?: NetworkOptions<OUTPUT>
): Promise<MastraAgentNetworkStream<OUTPUT>> {
  // Pass structuredOutput through to network loop
}
```

## Files to Modify

1. `packages/core/src/agent/agent.types.ts` - Add structuredOutput to NetworkOptions
2. `packages/core/src/stream/types.ts` - Add generic OUTPUT to payloads and new chunk types
3. `packages/core/src/stream/MastraAgentNetworkStream.ts` - Add object/objectStream getters
4. `packages/core/src/loop/network/validation.ts` - Modify generateFinalResult to accept schema
5. `packages/core/src/loop/network/index.ts` - Wire up structured output through the loop
6. `packages/core/src/agent/agent.ts` - Update network() method signature
7. `packages/core/src/agent/types.ts` - Export updated types

## API Examples

### Basic Usage
```typescript
import { z } from 'zod';

const resultSchema = z.object({
  summary: z.string(),
  recommendations: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

const stream = await agent.network("Analyze the user's request", {
  structuredOutput: {
    schema: resultSchema,
  },
});

// Get typed object directly
const result = await stream.object;
// result is typed as { summary: string; recommendations: string[]; confidence: number }
```

### With Streaming
```typescript
const stream = await agent.network(task, {
  structuredOutput: { schema: resultSchema },
});

// Stream partial objects as they're generated
for await (const partial of stream.objectStream) {
  console.log('Partial result:', partial);
}

// Or get the final object
const finalResult = await stream.object;
```

### With Custom Model
```typescript
const stream = await agent.network(task, {
  structuredOutput: {
    schema: resultSchema,
    model: openai('gpt-4o'), // Use specific model for structuring
  },
});
```

## Testing Strategy

1. **Unit tests** for:
   - NetworkOptions type validation with structuredOutput
   - MastraAgentNetworkStream object/objectStream getters
   - generateFinalResult with user schema

2. **Integration tests** for:
   - End-to-end network execution with structured output
   - Streaming partial objects
   - Error handling when schema validation fails
   - Memory integration with structured results

## Considerations

### Backward Compatibility
- All changes are additive; existing code without structuredOutput continues to work
- NetworkOptions remains backward compatible (structuredOutput is optional)

### Edge Cases
- Network completes early (no primitive selected) - still generate structured output
- Validation with custom scorers - structured output generated after scorers pass
- Memory integration - structured objects stored in message metadata

### Future Enhancements
- Support `jsonPromptInjection` fallback for models without native structured output
- Add `errorStrategy` for handling validation failures
- Consider adding structured output to intermediate primitive results
