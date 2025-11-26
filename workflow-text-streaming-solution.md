# Workflow Text Streaming Solution

## Problem Summary

When workflow steps contain agents that stream text (using `writer.pipeTo()`), the text content is wrapped in `workflow-step-output` events but not properly converted to AI SDK `text-delta` events. This prevents the text from appearing in the UI when using `useChat` from `@ai-sdk/react`.

## Root Cause

The `WorkflowStreamToAISDKTransformer` in `transformers.ts` only handles `workflow-step-output` events that contain `DataChunkType` objects. It doesn't process nested agent stream chunks (like `text-delta`, `text-start`, etc.) that are piped through the writer.

## Solution

Modify the `transformWorkflow` function in `client-sdks/ai-sdk/src/transformers.ts` to:

1. Detect when `workflow-step-output` contains agent stream chunks
2. Extract and forward text-related chunks directly to the output stream
3. Add an optional `sendText` parameter to control this behavior (defaulting to `true`)

### Implementation Changes

#### 1. Update `workflow-route.ts`

Add a `sendText` parameter to the route options:

```typescript
// client-sdks/ai-sdk/src/workflow-route.ts

export type WorkflowRouteOptions =
  | { path: `${string}:workflowId${string}`; workflow?: never; sendText?: boolean }
  | { path: string; workflow: string; sendText?: boolean };

export function workflowRoute({
  path = '/api/workflows/:workflowId/stream',
  workflow,
  sendText = true,  // Default to true for backward compatibility
}: WorkflowRouteOptions): ReturnType<typeof registerApiRoute> {
  // ...existing code...

  // Pass sendText to the transformer
  const uiMessageStream = createUIMessageStream({
    execute: async ({ writer }) => {
      for await (const part of toAISdkV5Stream(stream, { from: 'workflow', sendText })) {
        writer.write(part);
      }
    },
  });
```

#### 2. Update `convert-streams.ts`

Pass the `sendText` option through to the transformer:

```typescript
// client-sdks/ai-sdk/src/convert-streams.ts

export function toAISdkV5Stream<...>(
  stream: MastraWorkflowStream<TState, TInput, TOutput, TSteps>,
  options: { from: 'workflow'; sendText?: boolean },
): ReadableStream<InferUIMessageChunk<UIMessage>>;

// In the implementation:
if (from === 'workflow') {
  return (stream as ReadableStream<ChunkType>).pipeThrough(
    WorkflowStreamToAISDKTransformer(options.sendText ?? true)
  ) as ReadableStream<InferUIMessageChunk<UIMessage>>;
}
```

#### 3. Update `transformers.ts`

Modify `WorkflowStreamToAISDKTransformer` and `transformWorkflow` to handle nested agent chunks:

```typescript
// client-sdks/ai-sdk/src/transformers.ts

export function WorkflowStreamToAISDKTransformer(sendText: boolean = true) {
  const bufferedWorkflows = new Map<
    string,
    {
      name: string;
      steps: Record<string, StepResult>;
    }
  >();

  let textStarted = false;
  let currentMessageId: string | null = null;

  return new TransformStream<
    ChunkType,
    | {
        data?: string;
        type?: 'start' | 'finish' | 'text-start' | 'text-delta';
        id?: string;
        delta?: string;
      }
    | WorkflowDataPart
    | ChunkType
  >({
    start(controller) {
      controller.enqueue({ type: 'start' });
    },
    flush(controller) {
      controller.enqueue({ type: 'finish' });
    },
    transform(chunk, controller) {
      const transformed = transformWorkflow<any>(chunk, bufferedWorkflows, false, sendText);

      if (transformed) {
        // Handle array of transforms (for nested agent chunks)
        if (Array.isArray(transformed)) {
          transformed.forEach(t => controller.enqueue(t));
        } else {
          controller.enqueue(transformed);
        }
      }
    },
  });
}

export function transformWorkflow<TOutput extends ZodType<any>>(
  payload: ChunkType<TOutput>,
  bufferedWorkflows: Map<
    string,
    {
      name: string;
      steps: Record<string, StepResult>;
    }
  >,
  isNested?: boolean,
  sendText: boolean = true,
) {
  switch (payload.type) {
    // ...existing cases...

    case 'workflow-step-output': {
      const output = payload.payload.output;

      // Handle nested agent stream chunks
      if (sendText && output && typeof output === 'object') {
        const results: any[] = [];

        // Check if it's an agent stream chunk
        if ('type' in output && 'runId' in output) {
          const chunkType = output.type as string;

          // Handle text streaming chunks
          if (chunkType === 'text-start') {
            results.push({
              type: 'text-start',
              id: output.runId,
            });
          } else if (chunkType === 'text-delta' && 'payload' in output && output.payload?.text) {
            results.push({
              type: 'text-delta',
              id: output.runId,
              delta: output.payload.text,
            });
          }
          // Handle other agent stream chunks that might contain text
          else if (chunkType === 'start' && 'payload' in output) {
            // Agent stream start - might want to emit text-start
            results.push({
              type: 'text-start',
              id: output.runId,
            });
          }
        }

        // Also check for DataChunkType as before
        if (isDataChunkType(output)) {
          if (!('data' in output)) {
            throw new Error(
              `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(output)}`,
            );
          }
          results.push(output);
        }

        return results.length > 0 ? results : null;
      }

      // Original DataChunkType handling
      if (output && isDataChunkType(output)) {
        if (!('data' in output)) {
          throw new Error(
            `UI Messages require a data property when using data- prefixed chunks \n ${JSON.stringify(output)}`,
          );
        }
        return output;
      }
      return null;
    }

    // ...rest of cases...
  }
}
```

## Testing

To test this solution:

1. Create a workflow with an agent step that streams text:

```typescript
const planActivities = createStep({
  id: 'plan-activities',
  description: 'Suggests activities based on weather conditions',
  inputSchema: forecastSchema,
  outputSchema: z.object({
    activities: z.string(),
  }),
  execute: async ({ inputData, mastra, writer }) => {
    const agent = mastra?.getAgent('weatherAgent');
    if (!agent) {
      throw new Error('Weather agent not found');
    }

    const response = await agent.stream(...);
    await response.fullStream.pipeTo(writer);

    return { activities: 'Activities planned' };
  }
});
```

2. Use the workflow with AI SDK:

```typescript
// Backend
import { workflowRoute } from '@mastra/ai-sdk';

app.post(
  '/api/workflow',
  workflowRoute({
    path: '/api/workflow',
    workflow: 'weather-workflow',
    sendText: true, // Enable text streaming (default)
  }),
);

// Frontend
import { useChat } from '@ai-sdk/react';

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/workflow',
});
```

3. Verify that text from the agent appears in the UI as it streams.

## Configuration

The `sendText` parameter can be used to control this behavior:

- `sendText: true` (default) - Extract and stream text from nested agent chunks
- `sendText: false` - Only emit workflow metadata (previous behavior)

## Benefits

1. **Seamless Integration**: Text from agents within workflows streams directly to the UI
2. **Backward Compatible**: Default behavior maintains text streaming; can be disabled if needed
3. **Clean Architecture**: Handles the unwrapping at the transformer level where it belongs
4. **Type Safe**: Maintains TypeScript type safety throughout the transformation

## Alternative Approaches Considered

1. **Manual transformation in route handler**: Would require duplicating logic in every route
2. **Modifying workflow execution**: Would break separation of concerns
3. **Client-side processing**: Would require all frontend consumers to implement the same logic

The chosen approach keeps the transformation logic centralized and reusable.
